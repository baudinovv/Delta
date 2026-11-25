package app.delta.auth;

import app.delta.common.ApiException;
import app.delta.common.Tokens;
import app.delta.onboarding.AppUser;
import app.delta.onboarding.OnboardingRequest;
import app.delta.onboarding.OnboardingResponse;
import app.delta.onboarding.UserRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.Locale;
import java.util.UUID;

@Service
public class AuthService {

    static final String UNDER_18_MESSAGE =
            "Delta is for adults 18 and over. Please train with a qualified coach or a PE teacher "
                    + "who can supervise you.";
    static final String HEALTH_FLAG_MESSAGE =
            "Based on your answers, Delta can't safely guide your training on its own. "
                    + "Please talk to a doctor or a qualified trainer before you start.";

    public record Signed(UUID userId, String token) {}

    private final UserRepository users;
    private final SessionRepository sessions;
    private final LoginLimiter limiter;
    private final Clock clock;
    private final BCryptPasswordEncoder passwords = new BCryptPasswordEncoder();

    public AuthService(UserRepository users, SessionRepository sessions, LoginLimiter limiter, Clock clock) {
        this.users = users;
        this.sessions = sessions;
        this.limiter = limiter;
        this.clock = clock;
    }

    static String normalize(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    /** Screening first: referred people get no account and nothing is stored. */
    @Transactional
    public OnboardingResponse register(OnboardingRequest req) {
        if (!req.adult()) return OnboardingResponse.referred("UNDER_18", UNDER_18_MESSAGE);
        if (!req.screening().flags().isEmpty()) {
            return OnboardingResponse.referred("HEALTH_SCREENING", HEALTH_FLAG_MESSAGE);
        }
        if (!req.consent()) {
            throw ApiException.badRequest("CONSENT_REQUIRED", "Please accept the consent to continue.");
        }
        if (req.account() == null) throw ApiException.badRequest("ACCOUNT_REQUIRED", "Enter name, email and password.");

        String email = normalize(req.account().email());
        if (users.existsByEmail(email)) throw emailTaken();
        AppUser user = new AppUser(UUID.randomUUID(), email, passwords.encode(req.account().password()),
                req.account().name().trim(), Instant.now(clock), req.goal(), req.daysPerWeek(),
                req.minutesPerSession());
        if (req.body() != null) {
            var b = req.body();
            user.updateBody(b.sex(), b.birthYear(), b.heightCm(), b.weightKg(), null);
        }
        try {
            users.saveAndFlush(user);
        } catch (DataIntegrityViolationException e) {
            throw emailTaken(); // two sign-ups racing for the same email; the unique index wins
        }
        return OnboardingResponse.admitted(user.getId(), newSession(user.getId()));
    }

    @Transactional
    public Signed login(String rawEmail, String password) {
        String email = normalize(rawEmail);
        if (limiter.blocked(email)) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "TOO_MANY_ATTEMPTS",
                    "Too many attempts. Try again in 15 minutes.");
        }
        AppUser user = users.findByEmail(email).orElse(null);
        if (user == null || user.getPasswordHash() == null || !passwords.matches(password, user.getPasswordHash())) {
            limiter.failed(email);
            throw new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", "Wrong email or password.");
        }
        limiter.succeeded(email);
        return new Signed(user.getId(), newSession(user.getId()));
    }

    @Transactional
    public void logout(String tokenHash) {
        sessions.deleteById(tokenHash);
    }

    /** Changing the password signs out every other device. */
    @Transactional
    public void changePassword(UUID userId, String currentTokenHash, String current, String next) {
        AppUser user = users.findById(userId).orElseThrow(ApiException::unauthorized);
        checkPassword(user, current);
        user.setPasswordHash(passwords.encode(next));
        sessions.deleteOthers(userId, currentTokenHash);
    }

    @Transactional
    public void deleteAccount(UUID userId, String password) {
        AppUser user = users.findById(userId).orElseThrow(ApiException::unauthorized);
        checkPassword(user, password);
        users.delete(user); // sessions, sets, food and coach messages go with it (ON DELETE CASCADE)
    }

    private void checkPassword(AppUser user, String password) {
        if (user.getPasswordHash() == null || !passwords.matches(password, user.getPasswordHash())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "WRONG_PASSWORD", "The password is wrong.");
        }
    }

    private static ApiException emailTaken() {
        return new ApiException(HttpStatus.CONFLICT, "EMAIL_TAKEN", "An account with this email already exists.");
    }

    private String newSession(UUID userId) {
        String token = Tokens.newToken();
        sessions.save(new Session(Tokens.hash(token), userId, Instant.now(clock)));
        return token;
    }
}
