package app.delta.auth;

import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** Slows down password guessing: 5 failed logins per email per 15 minutes. In-memory, fine for one instance. */
@Component
public class LoginLimiter {

    static final int MAX_FAILURES = 5;
    static final Duration WINDOW = Duration.ofMinutes(15);

    private record Attempts(int failures, Instant since) {}

    private final Map<String, Attempts> byEmail = new ConcurrentHashMap<>();
    private final Clock clock;

    public LoginLimiter(Clock clock) {
        this.clock = clock;
    }

    public boolean blocked(String email) {
        Attempts a = byEmail.get(email);
        if (a == null) return false;
        if (a.since().plus(WINDOW).isBefore(Instant.now(clock))) {
            byEmail.remove(email);
            return false;
        }
        return a.failures() >= MAX_FAILURES;
    }

    public void failed(String email) {
        Instant now = Instant.now(clock);
        byEmail.compute(email, (k, a) -> a == null || a.since().plus(WINDOW).isBefore(now)
                ? new Attempts(1, now) : new Attempts(a.failures() + 1, a.since()));
    }

    public void succeeded(String email) {
        byEmail.remove(email);
    }
}
