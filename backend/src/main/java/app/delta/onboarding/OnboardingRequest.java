package app.delta.onboarding;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

public record OnboardingRequest(
        @NotNull Boolean adult,
        @NotNull @Valid Screening screening,
        @NotNull Boolean consent,
        @NotNull Goal goal,
        @NotNull @Min(1) @Max(7) Integer daysPerWeek,
        @NotNull @Min(15) @Max(180) Integer minutesPerSession,
        @Valid Body body
) {
    /** Optional at onboarding; used for calorie targets. */
    public record Body(
            @Pattern(regexp = "MALE|FEMALE") String sex,
            @Min(1900) @Max(2100) Integer birthYear,
            @Min(100) @Max(250) Integer heightCm,
            @DecimalMin("30") @DecimalMax("300") BigDecimal weightKg
    ) {}

    // TODO: confirm questions with the coach
    public record Screening(
            @NotNull Boolean heartCondition,
            @NotNull Boolean chestPain,
            @NotNull Boolean dizziness,
            @NotNull Boolean injury,
            @NotNull Boolean pregnant
    ) {
        public List<String> flags() {
            List<String> flags = new ArrayList<>();
            if (heartCondition) flags.add("heartCondition");
            if (chestPain) flags.add("chestPain");
            if (dizziness) flags.add("dizziness");
            if (injury) flags.add("injury");
            if (pregnant) flags.add("pregnant");
            return flags;
        }
    }
}
