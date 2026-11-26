package app.delta.onboarding;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class OnboardingController {

    private final OnboardingService onboarding;

    public OnboardingController(OnboardingService onboarding) {
        this.onboarding = onboarding;
    }

    @PostMapping("/api/onboarding")
    public ResponseEntity<OnboardingResponse> onboard(@Valid @RequestBody OnboardingRequest request) {
        OnboardingResponse result = onboarding.onboard(request);
        HttpStatus status = result.status() == OnboardingResponse.Status.ADMITTED ? HttpStatus.CREATED : HttpStatus.OK;
        return ResponseEntity.status(status).body(result);
    }
}
