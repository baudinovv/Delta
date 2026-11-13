package app.delta.log;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class LogDtos {
    private LogDtos() {}

    public record NewSet(
            @NotBlank @Size(max = 60) String exercise,
            @NotNull @DecimalMin("0") @DecimalMax("1000") BigDecimal weightKg,
            Integer reps
    ) {}

    public record LoggedSet(UUID id, String exercise, BigDecimal weightKg, int reps, Instant performedAt) {
        static LoggedSet of(SetLog s) {
            return new LoggedSet(s.getId(), s.getExercise(), s.getWeightKg(), s.getReps(), s.getPerformedAt());
        }
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record PrefillRow(String exercise, BigDecimal weightKg, Integer reps, String hint) {}

    public record TodayLog(List<PrefillRow> rows, List<LoggedSet> todaySets) {}
}
