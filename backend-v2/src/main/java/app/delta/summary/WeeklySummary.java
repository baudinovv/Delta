package app.delta.summary;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record WeeklySummary(Mode mode, String message, int weeksLogged, List<ExerciseSummary> exercises) {

    public enum Mode { BASELINE, COMPARISON }

    public enum Trend { UP, FLAT, DOWN, NEW }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record ExerciseSummary(String exercise, BestSet first, BestSet latest, Trend trend, List<BestSet> weeks) {}

    public record BestSet(LocalDate weekStart, BigDecimal weightKg, int reps) {}
}
