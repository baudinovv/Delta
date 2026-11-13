package app.delta.dashboard;

import app.delta.common.ApiException;
import app.delta.common.AuthInterceptor;
import app.delta.config.DeltaProperties;
import app.delta.log.SetLog;
import app.delta.log.SetLogRepository;
import app.delta.nutrition.FoodEntry;
import app.delta.nutrition.FoodEntryRepository;
import app.delta.nutrition.NutritionService;
import app.delta.onboarding.UserRepository;
import app.delta.profile.NutritionTargets;
import app.delta.profile.TargetService;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@RestController
public class DashboardController {

    static final int WEEKS_OF_LIFTS = 6;

    public record Day(LocalDate date, int kcal, int sets, int volumeKg) {}

    public record Lift(String exercise, BigDecimal weightKg, int reps, List<Double> e1rmByWeek) {}

    public record Dashboard(LocalDate date, NutritionTargets targets, int kcalToday, int proteinToday,
                            int fatToday, int carbsToday, int setsToday, int workoutsThisWeek, int plannedPerWeek,
                            int streakDays, List<Day> days, List<Lift> lifts) {}

    private final UserRepository users;
    private final SetLogRepository sets;
    private final FoodEntryRepository food;
    private final NutritionService nutrition;
    private final TargetService targets;
    private final DeltaProperties props;

    public DashboardController(UserRepository users, SetLogRepository sets, FoodEntryRepository food,
                               NutritionService nutrition, TargetService targets, DeltaProperties props) {
        this.users = users;
        this.sets = sets;
        this.food = food;
        this.nutrition = nutrition;
        this.targets = targets;
        this.props = props;
    }

    @GetMapping("/api/dashboard")
    @Transactional(readOnly = true)
    public Dashboard dashboard(@RequestAttribute(AuthInterceptor.USER_ID) UUID userId) {
        var user = users.findById(userId).orElseThrow(ApiException::unauthorized);
        LocalDate today = nutrition.today();
        LocalDate liftsFrom = today.with(DayOfWeek.MONDAY).minusWeeks(WEEKS_OF_LIFTS - 1);
        LocalDate from = liftsFrom.isBefore(today.minusDays(60)) ? liftsFrom : today.minusDays(60);

        List<SetLog> setList = sets.findByUserIdAndPerformedAtGreaterThanEqualOrderByPerformedAtAsc(
                userId, from.atStartOfDay(props.zone()).toInstant());
        List<FoodEntry> foodList = food.findByUserIdAndEatenOnBetween(userId, from, today);

        Map<LocalDate, int[]> perDay = new HashMap<>(); // kcal, sets, volume
        Set<LocalDate> active = new HashSet<>();
        for (SetLog s : setList) {
            LocalDate d = s.getPerformedAt().atZone(props.zone()).toLocalDate();
            int[] v = perDay.computeIfAbsent(d, k -> new int[3]);
            v[1]++;
            v[2] += (int) Math.round(s.getWeightKg().doubleValue() * s.getReps());
            active.add(d);
        }
        double p = 0, f = 0, c = 0;
        for (FoodEntry e : foodList) {
            perDay.computeIfAbsent(e.getEatenOn(), k -> new int[3])[0] += e.getKcal();
            active.add(e.getEatenOn());
            if (e.getEatenOn().equals(today)) {
                p += e.getProteinG().doubleValue();
                f += e.getFatG().doubleValue();
                c += e.getCarbsG().doubleValue();
            }
        }

        List<Day> days = new ArrayList<>();
        for (int i = 6; i >= 0; i--) {
            LocalDate d = today.minusDays(i);
            int[] v = perDay.getOrDefault(d, new int[3]);
            days.add(new Day(d, v[0], v[1], v[2]));
        }

        LocalDate monday = today.with(DayOfWeek.MONDAY);
        int workoutsThisWeek = (int) perDay.entrySet().stream()
                .filter(e -> !e.getKey().isBefore(monday) && e.getValue()[1] > 0).count();

        int streak = 0;
        LocalDate cursor = active.contains(today) ? today : today.minusDays(1);
        while (active.contains(cursor)) {
            streak++;
            cursor = cursor.minusDays(1);
        }

        int[] todayV = perDay.getOrDefault(today, new int[3]);
        return new Dashboard(today, targets.forUser(user), todayV[0], (int) Math.round(p), (int) Math.round(f),
                (int) Math.round(c), todayV[1], workoutsThisWeek,
                user.getDaysPerWeek(), streak, days, lifts(setList, liftsFrom));
    }

    /** Top 3 exercises by number of sets, with best estimated 1RM per week (Epley). */
    private List<Lift> lifts(List<SetLog> setList, LocalDate from) {
        Map<String, List<SetLog>> byEx = new LinkedHashMap<>();
        for (SetLog s : setList) {
            if (s.getPerformedAt().atZone(props.zone()).toLocalDate().isBefore(from)) continue;
            byEx.computeIfAbsent(s.getExercise(), k -> new ArrayList<>()).add(s);
        }
        return byEx.entrySet().stream()
                .sorted(Comparator.comparingInt((Map.Entry<String, List<SetLog>> e) -> e.getValue().size()).reversed())
                .limit(3)
                .map(e -> {
                    Double[] weeks = new Double[WEEKS_OF_LIFTS];
                    SetLog best = null;
                    for (SetLog s : e.getValue()) {
                        LocalDate d = s.getPerformedAt().atZone(props.zone()).toLocalDate();
                        int w = (int) ChronoUnit.WEEKS.between(from, d);
                        if (w < 0 || w >= WEEKS_OF_LIFTS) continue;
                        double e1rm = e1rm(s);
                        if (weeks[w] == null || e1rm > weeks[w]) weeks[w] = Math.round(e1rm * 10) / 10.0;
                        if (best == null || e1rm >= e1rm(best)) best = s;
                    }
                    return new Lift(e.getKey(), best.getWeightKg(), best.getReps(), Arrays.asList(weeks));
                })
                .toList();
    }

    private static double e1rm(SetLog s) {
        return s.getWeightKg().doubleValue() * (1 + s.getReps() / 30.0);
    }
}
