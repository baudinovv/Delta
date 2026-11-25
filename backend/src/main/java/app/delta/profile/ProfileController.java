package app.delta.profile;

import app.delta.common.ApiException;
import app.delta.common.AuthInterceptor;
import app.delta.onboarding.AppUser;
import app.delta.onboarding.Goal;
import app.delta.onboarding.UserRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@RestController
public class ProfileController {

    private final UserRepository users;
    private final TargetService targets;

    public ProfileController(UserRepository users, TargetService targets) {
        this.users = users;
        this.targets = targets;
    }

    public record Me(UUID userId, String name, String email, Instant createdAt,
                     Goal goal, int daysPerWeek, int minutesPerSession, Instant consentAt,
                     String sex, Integer birthYear, Integer heightCm, BigDecimal weightKg, Integer calorieTarget,
                     NutritionTargets targets) {}

    public record UpdateProfile(
            @Size(min = 1, max = 40) String name,
            @NotNull Goal goal,
            @NotNull @Min(1) @Max(7) Integer daysPerWeek,
            @NotNull @Min(15) @Max(180) Integer minutesPerSession,
            @Pattern(regexp = "MALE|FEMALE") String sex,
            @Min(1900) @Max(2100) Integer birthYear,
            @Min(100) @Max(250) Integer heightCm,
            @DecimalMin("30") @DecimalMax("300") BigDecimal weightKg,
            @Min(800) @Max(6000) Integer calorieTarget
    ) {}

    @GetMapping("/api/me")
    @Transactional(readOnly = true)
    public Me me(@RequestAttribute(AuthInterceptor.USER_ID) UUID userId) {
        return toMe(load(userId));
    }

    @PutMapping("/api/profile")
    @Transactional
    public Me update(@RequestAttribute(AuthInterceptor.USER_ID) UUID userId, @Valid @RequestBody UpdateProfile req) {
        AppUser u = load(userId);
        if (req.name() != null && !req.name().isBlank()) u.setName(req.name().trim());
        u.updatePlan(req.goal(), req.daysPerWeek(), req.minutesPerSession());
        u.updateBody(req.sex(), req.birthYear(), req.heightCm(), req.weightKg(), req.calorieTarget());
        return toMe(users.save(u));
    }

    private AppUser load(UUID userId) {
        return users.findById(userId).orElseThrow(ApiException::unauthorized);
    }

    private Me toMe(AppUser u) {
        return new Me(u.getId(), u.getName(), u.getEmail(), u.getCreatedAt(),
                u.getGoal(), u.getDaysPerWeek(), u.getMinutesPerSession(), u.getConsentAt(),
                u.getSex(), u.getBirthYear(), u.getHeightCm(), u.getWeightKg(), u.getCalorieTarget(), targets.forUser(u));
    }
}
