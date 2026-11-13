package app.delta.onboarding;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record OnboardingResponse(Status status, UUID userId, String token, String reason, String message) {

    public enum Status { ADMITTED, REFERRED }

    public static OnboardingResponse admitted(UUID userId, String token) {
        return new OnboardingResponse(Status.ADMITTED, userId, token, null, null);
    }

    public static OnboardingResponse referred(String reason, String message) {
        return new OnboardingResponse(Status.REFERRED, null, null, reason, message);
    }
}
