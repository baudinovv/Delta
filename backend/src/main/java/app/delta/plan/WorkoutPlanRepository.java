package app.delta.plan;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface WorkoutPlanRepository extends JpaRepository<WorkoutPlan, UUID> {}
