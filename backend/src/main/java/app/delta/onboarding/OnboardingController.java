package app.delta.onboarding;

import app.delta.common.ApiException;
import app.delta.common.AuthInterceptor;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.UUID;

@RestController
public class OnboardingController {

    private final OnboardingService onboarding;
    private final UserRepository users;

    public OnboardingController(OnboardingService onboarding, UserRepository users) {
        this.onboarding = onboarding;
        this.users = users;
    }

    @PostMapping("/api/onboarding")
    public ResponseEntity<OnboardingResponse> onboard(@Valid @RequestBody OnboardingRequest request) {
        OnboardingResponse result = onboarding.onboard(request);
        HttpStatus status = result.status() == OnboardingResponse.Status.ADMITTED ? HttpStatus.CREATED : HttpStatus.OK;
        return ResponseEntity.status(status).body(result);
    }

    public record Me(UUID userId, Goal goal, int daysPerWeek, int minutesPerSession, Instant consentAt) {}

    @GetMapping("/api/me")
    public Me me(@RequestAttribute(AuthInterceptor.USER_ID) UUID userId) {
        AppUser u = users.findById(userId).orElseThrow(ApiException::unauthorized);
        return new Me(u.getId(), u.getGoal(), u.getDaysPerWeek(), u.getMinutesPerSession(), u.getConsentAt());
    }
}
