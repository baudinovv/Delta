package app.delta.profile;

import app.delta.config.DeltaProperties;
import app.delta.onboarding.AppUser;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.LocalDate;

@Service
public class TargetService {

    private final DeltaProperties props;
    private final Clock clock;

    public TargetService(DeltaProperties props, Clock clock) {
        this.props = props;
        this.clock = clock;
    }

    /** Null when the profile lacks the data to compute targets. */
    public NutritionTargets forUser(AppUser u) {
        return NutritionTargets.of(u, LocalDate.now(clock.withZone(props.zone())).getYear()).orElse(null);
    }
}
