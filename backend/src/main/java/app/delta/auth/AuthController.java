package app.delta.auth;

import app.delta.auth.AuthService.Signed;
import app.delta.common.AuthInterceptor;
import app.delta.onboarding.OnboardingRequest;
import app.delta.onboarding.OnboardingResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService auth;

    public AuthController(AuthService auth) {
        this.auth = auth;
    }

    public record Login(@NotBlank @Size(max = 254) String email, @NotBlank @Size(max = 72) String password) {}

    public record ChangePassword(@NotBlank String currentPassword, @NotBlank @Size(min = 8, max = 72) String newPassword) {}

    public record DeleteAccount(@NotBlank String password) {}

    /** Onboarding answers + account in one call; the account is created only if screening passes. */
    @PostMapping("/register")
    public ResponseEntity<OnboardingResponse> register(@Valid @RequestBody OnboardingRequest request) {
        OnboardingResponse result = auth.register(request);
        HttpStatus status = result.status() == OnboardingResponse.Status.ADMITTED ? HttpStatus.CREATED : HttpStatus.OK;
        return ResponseEntity.status(status).body(result);
    }

    @PostMapping("/login")
    public Signed login(@Valid @RequestBody Login body) {
        return auth.login(body.email(), body.password());
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(@RequestAttribute(AuthInterceptor.SESSION) String tokenHash) {
        auth.logout(tokenHash);
    }

    @PostMapping("/password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void changePassword(@RequestAttribute(AuthInterceptor.USER_ID) UUID userId,
                               @RequestAttribute(AuthInterceptor.SESSION) String tokenHash,
                               @Valid @RequestBody ChangePassword body) {
        auth.changePassword(userId, tokenHash, body.currentPassword(), body.newPassword());
    }

    @PostMapping("/delete-account")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteAccount(@RequestAttribute(AuthInterceptor.USER_ID) UUID userId,
                              @Valid @RequestBody DeleteAccount body) {
        auth.deleteAccount(userId, body.password());
    }
}
