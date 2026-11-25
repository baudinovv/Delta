package app.delta.coach;

import app.delta.ai.AiClient;
import app.delta.ai.AiClient.Turn;
import app.delta.common.ApiException;
import app.delta.config.DeltaProperties;
import app.delta.health.HealthService;
import app.delta.log.SetLog;
import app.delta.log.SetLogRepository;
import app.delta.nutrition.NutritionService;
import app.delta.onboarding.AppUser;
import app.delta.onboarding.UserRepository;
import app.delta.profile.NutritionTargets;
import app.delta.profile.TargetService;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeSet;
import java.util.UUID;

@Service
public class CoachService {

    public record Message(UUID id, String role, String content, Instant createdAt) {
        static Message of(CoachMessage m) {
            return new Message(m.getId(), m.getRole(), m.getContent(), m.getCreatedAt());
        }
    }

    public record Thread(List<Message> messages, boolean demo) {}

    private static final int HISTORY_FOR_MODEL = 20;

    private final CoachMessageRepository messages;
    private final UserRepository users;
    private final SetLogRepository sets;
    private final NutritionService nutrition;
    private final TargetService targets;
    private final HealthService health;
    private final AiClient ai;
    private final DeltaProperties props;
    private final Clock clock;

    public CoachService(CoachMessageRepository messages, UserRepository users, SetLogRepository sets,
                        NutritionService nutrition, TargetService targets, HealthService health, AiClient ai,
                        DeltaProperties props, Clock clock) {
        this.messages = messages;
        this.users = users;
        this.sets = sets;
        this.nutrition = nutrition;
        this.targets = targets;
        this.health = health;
        this.ai = ai;
        this.props = props;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public Thread thread(UUID userId) {
        List<Message> list = new ArrayList<>(messages.findByUserIdOrderByCreatedAtDesc(userId, PageRequest.of(0, 100))
                .stream().map(Message::of).toList());
        Collections.reverse(list);
        return new Thread(list, !ai.live());
    }

    /** Not transactional on purpose: the AI call can take seconds and shouldn't hold a DB connection. */
    public Message ask(UUID userId, String text, String lang) {
        AppUser user = users.findById(userId).orElseThrow(ApiException::unauthorized);

        List<CoachMessage> recent = new ArrayList<>(
                messages.findByUserIdOrderByCreatedAtDesc(userId, PageRequest.of(0, HISTORY_FOR_MODEL)));
        Collections.reverse(recent);
        List<Turn> turns = new ArrayList<>();
        for (CoachMessage m : recent) turns.add(new Turn(CoachMessage.USER.equals(m.getRole()), m.getContent()));
        turns.add(new Turn(true, text));

        String reply = ai.chat(systemPrompt(user, lang), turns);

        Instant now = Instant.now(clock);
        messages.save(new CoachMessage(UUID.randomUUID(), userId, CoachMessage.USER, text, now));
        CoachMessage saved = messages.save(
                new CoachMessage(UUID.randomUUID(), userId, CoachMessage.COACH, reply, now.plusMillis(1)));
        return Message.of(saved);
    }

    @Transactional
    public void clear(UUID userId) {
        messages.deleteAllForUser(userId);
    }

    private String systemPrompt(AppUser u, String lang) {
        boolean ru = "ru".equals(lang);
        StringBuilder s = new StringBuilder();
        s.append("""
                You are Delta Coach, a friendly strength coach for gym beginners who train without a coach. LANG=%s
                Answer in %s. Be concrete and short: 2-6 sentences or a short list. Plain text only, no markdown
                headings, tables or bold. Use the user's data below; give numbers (kg, reps, sets, grams, kcal)
                when useful. Progress gradually: +1 rep or +2.5 kg per week. You are not a doctor: for pain,
                dizziness, chest discomfort or injuries tell them to stop and see a doctor. Don't recommend
                supplements beyond protein, creatine and vitamin D, and never extreme diets (< 1200 kcal).
                Off-topic questions: politely steer back to training, food and recovery.

                USER DATA
                """.formatted(lang, ru ? "Russian" : "English"));
        s.append("Goal: ").append(u.getGoal()).append("; plans ").append(u.getDaysPerWeek())
                .append(" days/week, ").append(u.getMinutesPerSession()).append(" min/session\n");
        if (u.getSex() != null) s.append("Sex: ").append(u.getSex()).append('\n');
        if (u.getBirthYear() != null) s.append("Born: ").append(u.getBirthYear()).append('\n');
        if (u.getHeightCm() != null) s.append("Height: ").append(u.getHeightCm()).append(" cm\n");
        if (u.getWeightKg() != null) s.append("Weight: ").append(u.getWeightKg()).append(" kg\n");
        NutritionTargets t = targets.forUser(u);
        if (t != null) {
            s.append("Daily target: ").append(t.kcal()).append(" kcal, P ").append(t.proteinG())
                    .append(" g, F ").append(t.fatG()).append(" g, C ").append(t.carbsG()).append(" g\n");
        }

        LocalDate today = nutrition.today();
        Instant from = today.minusDays(13).atStartOfDay(props.zone()).toInstant();
        List<SetLog> recentSets = sets.findByUserIdAndPerformedAtGreaterThanEqualOrderByPerformedAtAsc(u.getId(), from);
        TreeSet<LocalDate> days = new TreeSet<>();
        Map<String, List<String>> byExercise = new LinkedHashMap<>();
        for (SetLog x : recentSets) {
            LocalDate d = x.getPerformedAt().atZone(props.zone()).toLocalDate();
            days.add(d);
            byExercise.computeIfAbsent(x.getExercise(), k -> new ArrayList<>())
                    .add(d + " " + x.getWeightKg().stripTrailingZeros().toPlainString() + "x" + x.getReps());
        }
        s.append("Today: ").append(today).append(" (").append(today.getDayOfWeek()).append(")\n");
        if (recentSets.isEmpty()) {
            s.append("Workouts in the last 14 days: none logged\n");
        } else {
            s.append("Workouts in the last 14 days: ").append(days.size()).append(" (last on ")
                    .append(days.last()).append(", ").append(ChronoUnit.DAYS.between(days.last(), today))
                    .append(" days ago)\n");
            byExercise.forEach((ex, list) -> s.append("- ").append(ex).append(": ")
                    .append(String.join(", ", list.subList(Math.max(0, list.size() - 12), list.size())))
                    .append('\n'));
        }
        if (u.getHealthConsentAt() != null) {
            var h = health.summary(u.getId(), 7);
            if (h.avgSteps() != null) s.append("Average steps (7 days, from phone/watch): ").append(h.avgSteps()).append('\n');
            if (h.avgActiveKcal() != null) {
                s.append("Average active energy: ").append(h.avgActiveKcal()).append(" kcal/day\n");
            }
            h.workouts().stream().limit(5).forEach(w -> s.append("- Watch workout ").append(w.date()).append(": ")
                    .append(w.type()).append(", ").append(w.minutes()).append(" min")
                    .append(w.energyKcal() != null ? ", " + w.energyKcal() + " kcal" : "")
                    .append(w.avgHr() != null ? ", avg HR " + w.avgHr() : "").append('\n'));
        }
        var food = nutrition.day(u.getId(), today);
        s.append("Eaten today: ").append(food.totals().kcal()).append(" kcal, P ").append(food.totals().proteinG())
                .append(" g, F ").append(food.totals().fatG()).append(" g, C ").append(food.totals().carbsG())
                .append(" g in ").append(food.entries().size()).append(" entries\n");
        return s.toString();
    }
}
