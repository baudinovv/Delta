package app.delta.coach;

import app.delta.ai.AiClient;
import app.delta.ai.AiClient.Turn;
import app.delta.common.ApiException;
import app.delta.config.DeltaProperties;
import app.delta.plan.PlanService;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
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

    @JsonInclude(JsonInclude.Include.NON_EMPTY)
    public record Message(UUID id, String role, String content, Instant createdAt, List<CoachTools.Action> actions) {}

    public record Thread(List<Message> messages, boolean demo) {}

    /** A voice message: what was heard, and the coach's reply to it. */
    public record VoiceReply(String transcript, Message reply) {}

    private static final int HISTORY_FOR_MODEL = 20;

    private final CoachMessageRepository messages;
    private final UserRepository users;
    private final SetLogRepository sets;
    private final NutritionService nutrition;
    private final TargetService targets;
    private final HealthService health;
    private final AiClient ai;
    private final CoachTools tools;
    private final PlanService plans;
    private final ObjectMapper json;
    private final DeltaProperties props;
    private final Clock clock;

    public CoachService(CoachMessageRepository messages, UserRepository users, SetLogRepository sets,
                        NutritionService nutrition, TargetService targets, HealthService health, AiClient ai,
                        CoachTools tools, PlanService plans, ObjectMapper json, DeltaProperties props, Clock clock) {
        this.messages = messages;
        this.users = users;
        this.sets = sets;
        this.nutrition = nutrition;
        this.targets = targets;
        this.health = health;
        this.ai = ai;
        this.tools = tools;
        this.plans = plans;
        this.json = json;
        this.props = props;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public Thread thread(UUID userId) {
        List<Message> list = new ArrayList<>(messages.findByUserIdOrderByCreatedAtDesc(userId, PageRequest.of(0, 100))
                .stream().map(this::toMessage).toList());
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

        CoachTools.Run run = tools.run(userId, lang);
        String reply;
        try {
            reply = ai.chatWithTools(systemPrompt(user, lang), turns, tools.tools(), run);
        } catch (ApiException e) {
            // The model may fail after it already logged something: never hide what was done.
            if (run.actions().isEmpty()) throw e;
            reply = "ru".equals(lang) ? "Готово." : "Done.";
        }

        Instant now = Instant.now(clock);
        messages.save(new CoachMessage(UUID.randomUUID(), userId, CoachMessage.USER, text, now));
        CoachMessage answer = new CoachMessage(UUID.randomUUID(), userId, CoachMessage.COACH, reply, now.plusMillis(1));
        if (!run.actions().isEmpty()) answer.setActions(write(run.actions()));
        return toMessage(messages.save(answer));
    }

    /** Speech → text → the same flow as a typed message. */
    public VoiceReply voice(UUID userId, String audioBase64, String mimeType, String lang) {
        String base64 = audioBase64.contains(",") && audioBase64.startsWith("data:")
                ? audioBase64.substring(audioBase64.indexOf(',') + 1) : audioBase64;
        String transcript = ai.transcribe(new AiClient.Image(mimeType, base64), lang);
        if (transcript.isBlank()) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "NOTHING_HEARD", "Didn't catch that. Try again.");
        }
        if (transcript.length() > 2000) transcript = transcript.substring(0, 2000);
        return new VoiceReply(transcript, ask(userId, transcript, lang));
    }

    private Message toMessage(CoachMessage m) {
        List<CoachTools.Action> actions = List.of();
        if (m.getActions() != null) {
            try {
                actions = List.of(json.readValue(m.getActions(), CoachTools.Action[].class));
            } catch (Exception e) {
                actions = List.of();
            }
        }
        return new Message(m.getId(), m.getRole(), m.getContent(), m.getCreatedAt(), actions);
    }

    private String write(Object o) {
        try {
            return json.writeValueAsString(o);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
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
                Answer in %s (in Russian, address the user informally as "ты"). Be concrete and short: 2-6 sentences or a short list. Plain text only, no markdown
                headings, tables or bold. Use the user's data below; give numbers (kg, reps, sets, grams, kcal)
                when useful. Progress gradually: +1 rep or +2.5 kg per week. You are not a doctor: for pain,
                dizziness, chest discomfort or injuries tell them to stop and see a doctor. Don't recommend
                supplements beyond protein, creatine and vitamin D, and never extreme diets (< 1200 kcal).
                Off-topic questions: politely steer back to training, food and recovery.

                ACTIONS. You can change the user's data with the functions you have:
                - When the user tells you what they did or ate ("запиши…", "я съел…", "сделал присед 60 на 5"),
                  log it right away; ask only if a key number is missing (reps or weight for sets). Sets are logged
                  for today. "3 по 5 с 60" means three sets of 5 reps at 60 kg.
                - Food: always pass your best estimate of grams, kcal and macros; typical portion if not said.
                - When asked for a plan ("составь план"), design it from their goal, days/week, minutes, recent
                  weights and known exercises, save it with save_workout_plan, then summarize it in a few lines.
                - Every request to log is a NEW action: call the function again even if an earlier message in the
                  chat logged something similar (people drink water and do sets more than once a day).
                - After acting, confirm briefly what you did (numbers included). Never say you logged or saved
                  something unless you called the function in THIS turn and it returned success; on error, say so.

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
        List<String> known = sets.findExercisesInFirstLoggedOrder(u.getId());
        if (!known.isEmpty()) s.append("Known exercises (reuse these names): ").append(String.join(", ", known)).append('\n');
        plans.get(u.getId()).ifPresent(p -> {
            s.append("Current plan: ").append(p.title()).append('\n');
            p.days().forEach(d -> s.append("- day ").append(d.weekday()).append(" (").append(d.focus()).append("): ")
                    .append(d.exercises().stream().map(e -> e.name() + " " + e.sets() + "x" + e.reps()).toList())
                    .append('\n'));
        });
        var food = nutrition.day(u.getId(), today);
        s.append("Eaten today: ").append(food.totals().kcal()).append(" kcal, P ").append(food.totals().proteinG())
                .append(" g, F ").append(food.totals().fatG()).append(" g, C ").append(food.totals().carbsG())
                .append(" g in ").append(food.entries().size()).append(" entries\n");
        return s.toString();
    }
}
