package app.delta.summary;

import app.delta.summary.SummaryCalculator.SetEntry;
import app.delta.summary.WeeklySummary.ExerciseSummary;
import app.delta.summary.WeeklySummary.Mode;
import app.delta.summary.WeeklySummary.Trend;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class SummaryCalculatorTest {

    private static final ZoneId ALMATY = ZoneId.of("Asia/Almaty");

    private static SetEntry set(String exercise, String kg, int reps, String localDateTime) {
        return new SetEntry(exercise, new BigDecimal(kg), reps,
                LocalDateTime.parse(localDateTime).atZone(ALMATY).toInstant());
    }

    private static ExerciseSummary find(WeeklySummary s, String exercise) {
        return s.exercises().stream().filter(e -> e.exercise().equals(exercise)).findFirst().orElseThrow();
    }

    @Test
    void lessThanTwoWeeksShowsBaseline() {
        var summary = SummaryCalculator.calculate(List.of(
                set("Squat", "40", 10, "2026-10-21T19:00"),
                set("Squat", "40", 8, "2026-10-21T19:10"),
                set("Bench Press", "30", 10, "2026-10-23T19:00")
        ), ALMATY);

        assertThat(summary.mode()).isEqualTo(Mode.BASELINE);
        assertThat(summary.message()).isEqualTo("Baseline saved, your first comparison appears next Sunday");
        assertThat(summary.weeksLogged()).isEqualTo(1);
        ExerciseSummary squat = find(summary, "Squat");
        assertThat(squat.latest().weightKg()).isEqualByComparingTo("40");
        assertThat(squat.latest().reps()).isEqualTo(10);
        assertThat(squat.first()).isNull();
        assertThat(squat.trend()).isNull();
        assertThat(squat.weeks()).isNull();
    }

    @Test
    void emptyLogIsBaselineWithNoExercises() {
        var summary = SummaryCalculator.calculate(List.of(), ALMATY);
        assertThat(summary.mode()).isEqualTo(Mode.BASELINE);
        assertThat(summary.exercises()).isEmpty();
    }

    // expected values counted by hand:
    // squat 40x10 -> 45x8 (up), bench 30x10 -> 30x10 (flat), row 35x12 -> 32.5x10 (down)
    @Test
    void threeWeekMockLogMatchesManualCheck() {
        var summary = SummaryCalculator.calculate(List.of(
                set("Squat", "40", 10, "2026-10-19T19:00"),
                set("Squat", "40", 8, "2026-10-19T19:05"),
                set("Bench Press", "30", 10, "2026-10-19T19:20"),
                set("Bench Press", "32.5", 6, "2026-10-19T19:25"),
                set("Seated Row", "35", 12, "2026-10-21T19:00"),

                set("Squat", "42.5", 10, "2026-10-26T19:00"),
                set("Bench Press", "30", 10, "2026-10-28T19:00"),
                set("Seated Row", "35", 10, "2026-10-28T19:20"),

                set("Squat", "45", 8, "2026-11-02T19:00"),
                set("Squat", "42.5", 10, "2026-11-02T19:05"),
                set("Bench Press", "30", 10, "2026-11-04T19:00"),
                set("Seated Row", "32.5", 10, "2026-11-04T19:20")
        ), ALMATY);

        assertThat(summary.mode()).isEqualTo(Mode.COMPARISON);
        assertThat(summary.weeksLogged()).isEqualTo(3);

        ExerciseSummary squat = find(summary, "Squat");
        assertThat(squat.first().weightKg()).isEqualByComparingTo("40");
        assertThat(squat.first().reps()).isEqualTo(10);
        assertThat(squat.latest().weightKg()).isEqualByComparingTo("45");
        assertThat(squat.latest().reps()).isEqualTo(8);
        assertThat(squat.trend()).isEqualTo(Trend.UP);
        assertThat(squat.weeks()).hasSize(3);

        ExerciseSummary bench = find(summary, "Bench Press");
        assertThat(bench.first().weightKg()).isEqualByComparingTo("30");
        assertThat(bench.latest().weightKg()).isEqualByComparingTo("30");
        assertThat(bench.trend()).isEqualTo(Trend.FLAT);

        ExerciseSummary row = find(summary, "Seated Row");
        assertThat(row.first().weightKg()).isEqualByComparingTo("35");
        assertThat(row.first().reps()).isEqualTo(12);
        assertThat(row.latest().weightKg()).isEqualByComparingTo("32.5");
        assertThat(row.trend()).isEqualTo(Trend.DOWN);
    }

    @Test
    void exerciseAddedLaterIsMarkedNew() {
        var summary = SummaryCalculator.calculate(List.of(
                set("Squat", "40", 10, "2026-10-19T19:00"),
                set("Squat", "42.5", 10, "2026-10-26T19:00"),
                set("Lunge", "10", 10, "2026-10-26T19:20")
        ), ALMATY);
        assertThat(find(summary, "Lunge").trend()).isEqualTo(Trend.NEW);
    }

    @Test
    void weekBoundaryUsesLocalTime() {
        var sunday = LocalDateTime.parse("2026-11-01T23:30").atZone(ALMATY).toInstant();
        var mondayEarly = LocalDateTime.parse("2026-11-02T01:00").atZone(ALMATY).toInstant();
        assertThat(SummaryCalculator.weekStart(sunday, ALMATY)).isEqualTo(LocalDate.parse("2026-10-26"));
        assertThat(SummaryCalculator.weekStart(mondayEarly, ALMATY)).isEqualTo(LocalDate.parse("2026-11-02"));
    }
}
