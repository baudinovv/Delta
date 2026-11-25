package app.delta.plan;

import app.delta.common.ApiException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class PlanService {

    public record PlannedExercise(String name, int sets, String reps, BigDecimal weightKg, String note) {}

    /** weekday: 1 = Monday … 7 = Sunday. */
    public record PlanDay(int weekday, String focus, List<PlannedExercise> exercises) {}

    public record Plan(String title, List<PlanDay> days, Instant createdAt) {}

    private final WorkoutPlanRepository plans;
    private final ObjectMapper json;
    private final Clock clock;

    public PlanService(WorkoutPlanRepository plans, ObjectMapper json, Clock clock) {
        this.plans = plans;
        this.json = json;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public Optional<Plan> get(UUID userId) {
        return plans.findById(userId).map(p -> {
            try {
                PlanDay[] days = json.readValue(p.getPlanJson(), PlanDay[].class);
                return new Plan(p.getTitle(), List.of(days), p.getCreatedAt());
            } catch (Exception e) {
                throw new IllegalStateException(e);
            }
        });
    }

    /** Validates and stores the plan, replacing any previous one. */
    @Transactional
    public Plan save(UUID userId, String title, List<PlanDay> days) {
        if (title == null || title.isBlank() || title.length() > 120) throw bad("Give the plan a short title.");
        if (days == null || days.isEmpty() || days.size() > 7) throw bad("A plan has 1 to 7 training days.");
        for (PlanDay d : days) {
            if (d.weekday() < 1 || d.weekday() > 7) throw bad("weekday must be 1 (Monday) to 7 (Sunday).");
            if (d.exercises() == null || d.exercises().isEmpty() || d.exercises().size() > 12) {
                throw bad("Each day needs 1 to 12 exercises.");
            }
            for (PlannedExercise e : d.exercises()) {
                if (e.name() == null || e.name().isBlank() || e.name().length() > 60) throw bad("Exercise name is required.");
                if (e.sets() < 1 || e.sets() > 10) throw bad("sets must be 1 to 10.");
            }
        }
        if (days.stream().map(PlanDay::weekday).distinct().count() != days.size()) throw bad("One entry per weekday.");
        List<PlanDay> sorted = days.stream().sorted((a, b) -> a.weekday() - b.weekday()).toList();
        try {
            String body = json.writeValueAsString(sorted);
            Instant now = Instant.now(clock);
            WorkoutPlan p = plans.findById(userId).orElseGet(() -> new WorkoutPlan(userId, title.trim(), body, now));
            p.replace(title.trim(), body, now);
            plans.save(p);
            return new Plan(title.trim(), sorted, now);
        } catch (Exception e) {
            if (e instanceof ApiException a) throw a;
            throw new IllegalStateException(e);
        }
    }

    @Transactional
    public void delete(UUID userId) {
        plans.deleteById(userId);
    }

    private static ApiException bad(String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, "BAD_PLAN", message);
    }
}
