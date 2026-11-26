package app.delta.onboarding;

import app.delta.common.ApiException;
import app.delta.common.Tokens;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.UUID;

@Service
public class OnboardingService {

    static final String UNDER_18_MESSAGE =
            "Delta is for adults 18 and over. Please train with a qualified coach or a PE teacher "
                    + "who can supervise you.";
    static final String HEALTH_FLAG_MESSAGE =
            "Based on your answers, Delta can't safely guide your training on its own. "
                    + "Please talk to a doctor or a qualified trainer before you start.";

    private final UserRepository users;
    private final Clock clock;

    public OnboardingService(UserRepository users, Clock clock) {
        this.users = users;
        this.clock = clock;
    }

    @Transactional
    public OnboardingResponse onboard(OnboardingRequest req) {
        if (!req.adult()) {
            return OnboardingResponse.referred("UNDER_18", UNDER_18_MESSAGE);
        }
        if (!req.screening().flags().isEmpty()) {
            return OnboardingResponse.referred("HEALTH_SCREENING", HEALTH_FLAG_MESSAGE);
        }
        if (!req.consent()) {
            throw ApiException.badRequest("CONSENT_REQUIRED", "Please accept the consent to continue.");
        }

        String token = Tokens.newToken();
        AppUser user = new AppUser(UUID.randomUUID(), Tokens.hash(token), Instant.now(clock),
                req.goal(), req.daysPerWeek(), req.minutesPerSession());
        user.setBmi(req.bmi());
        if (req.body() != null) {
            var b = req.body();
            user.updateBody(b.sex(), b.birthYear(), b.heightCm(), b.weightKg(), null);
        }
        users.save(user);
        return OnboardingResponse.admitted(user.getId(), token);
    }
}
