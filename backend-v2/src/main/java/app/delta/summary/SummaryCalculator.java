package app.delta.summary;

import app.delta.summary.WeeklySummary.BestSet;
import app.delta.summary.WeeklySummary.ExerciseSummary;
import app.delta.summary.WeeklySummary.Mode;
import app.delta.summary.WeeklySummary.Trend;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TreeMap;
import java.util.TreeSet;

public final class SummaryCalculator {

    public static final String BASELINE_MESSAGE = "Baseline saved, your first comparison appears next Sunday";

    public record SetEntry(String exercise, BigDecimal weightKg, int reps, Instant performedAt) {}

    private SummaryCalculator() {}

    public static WeeklySummary calculate(List<SetEntry> sets, ZoneId zone) {
        Map<String, String> displayName = new LinkedHashMap<>();
        Map<String, TreeMap<LocalDate, SetEntry>> bestByWeek = new LinkedHashMap<>();
        TreeSet<LocalDate> allWeeks = new TreeSet<>();

        List<SetEntry> ordered = new ArrayList<>(sets);
        ordered.sort((a, b) -> a.performedAt().compareTo(b.performedAt()));

        for (SetEntry s : ordered) {
            String key = s.exercise().trim().toLowerCase(Locale.ROOT);
            displayName.putIfAbsent(key, s.exercise().trim());
            LocalDate week = weekStart(s.performedAt(), zone);
            allWeeks.add(week);
            bestByWeek.computeIfAbsent(key, k -> new TreeMap<>())
                    .merge(week, s, (current, candidate) -> isBetter(candidate, current) ? candidate : current);
        }

        boolean baseline = allWeeks.size() < 2;
        List<ExerciseSummary> exercises = new ArrayList<>();

        for (var e : bestByWeek.entrySet()) {
            TreeMap<LocalDate, SetEntry> weeks = e.getValue();
            String name = displayName.get(e.getKey());

            if (baseline) {
                SetEntry best = weeks.lastEntry().getValue();
                exercises.add(new ExerciseSummary(name, null, toBest(weeks.lastKey(), best), null, null));
                continue;
            }

            List<BestSet> history = weeks.entrySet().stream().map(w -> toBest(w.getKey(), w.getValue())).toList();
            BestSet first = history.get(0);
            BestSet latest = history.get(history.size() - 1);
            Trend trend = weeks.size() < 2 ? Trend.NEW : trend(weeks.firstEntry().getValue(), weeks.lastEntry().getValue());
            exercises.add(new ExerciseSummary(name, first, latest, trend, history));
        }

        return new WeeklySummary(baseline ? Mode.BASELINE : Mode.COMPARISON,
                baseline ? BASELINE_MESSAGE : null, allWeeks.size(), exercises);
    }

    public static LocalDate weekStart(Instant at, ZoneId zone) {
        return at.atZone(zone).toLocalDate().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
    }

    // epley formula
    static double estimatedOneRepMax(SetEntry s) {
        return s.weightKg().doubleValue() * (1 + s.reps() / 30.0);
    }

    static boolean isBetter(SetEntry a, SetEntry b) {
        int byE1rm = Double.compare(round2(estimatedOneRepMax(a)), round2(estimatedOneRepMax(b)));
        if (byE1rm != 0) return byE1rm > 0;
        int byWeight = a.weightKg().compareTo(b.weightKg());
        if (byWeight != 0) return byWeight > 0;
        return a.reps() > b.reps();
    }

    static Trend trend(SetEntry first, SetEntry latest) {
        if (isBetter(latest, first)) return Trend.UP;
        if (isBetter(first, latest)) return Trend.DOWN;
        return Trend.FLAT;
    }

    private static double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }

    private static BestSet toBest(LocalDate week, SetEntry s) {
        return new BestSet(week, s.weightKg(), s.reps());
    }
}
