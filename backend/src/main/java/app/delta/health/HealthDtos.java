package app.delta.health;

import app.delta.health.HealthSample.Kind;
import app.delta.health.HealthSample.Platform;
import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public final class HealthDtos {
    private HealthDtos() {}

    public record Consent(@NotNull Boolean consent) {}

    public record Status(boolean consent, Instant consentAt, Instant syncedAt, long samples) {}

    /** One record from the phone. For daily totals externalId is "<kind>:<yyyy-mm-dd>". */
    public record Sample(
            @NotNull Kind kind,
            @NotBlank @Size(max = 128) String externalId,
            @NotNull Instant start,
            @NotNull Instant end,
            @DecimalMin("0") @DecimalMax("1000000") BigDecimal value,
            @Size(max = 40) String workoutType,
            @DecimalMin("0") @DecimalMax("20000") BigDecimal energyKcal,
            @Min(20) @Max(250) Integer avgHr,
            @Size(max = 80) String sourceName,
            Boolean fromDelta
    ) {}

    public record Sync(@NotNull Platform platform, @NotNull @Size(max = 1000) List<@Valid Sample> samples) {}

    public record SyncResult(int inserted, int updated, Instant syncedAt) {}

    public record Day(LocalDate date, Integer steps, Integer activeKcal, Integer avgHr, int workouts) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Workout(LocalDate date, Instant start, Instant end, String type, int minutes, Integer energyKcal,
                          Integer avgHr, String source, Platform platform) {}

    public record Summary(boolean consent, Instant syncedAt, List<Day> days, List<Workout> workouts, Integer avgSteps,
                          Integer avgActiveKcal, Integer stepsToday, Integer activeKcalToday) {}

    /** A Delta strength session (a day's logged sets) that the phone can write to Apple Health / Health Connect. */
    public record Session(LocalDate date, Instant start, Instant end, int sets, int volumeKg, List<String> exercises) {}
}
