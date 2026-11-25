package app.delta.plan;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "workout_plans")
public class WorkoutPlan {

    @Id
    @Column(name = "user_id")
    private UUID userId;

    @Column(nullable = false, length = 120)
    private String title;

    @Column(name = "plan_json", nullable = false, columnDefinition = "TEXT")
    private String planJson;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected WorkoutPlan() {}

    public WorkoutPlan(UUID userId, String title, String planJson, Instant createdAt) {
        this.userId = userId;
        this.title = title;
        this.planJson = planJson;
        this.createdAt = createdAt;
    }

    public void replace(String title, String planJson, Instant createdAt) {
        this.title = title;
        this.planJson = planJson;
        this.createdAt = createdAt;
    }

    public UUID getUserId() { return userId; }
    public String getTitle() { return title; }
    public String getPlanJson() { return planJson; }
    public Instant getCreatedAt() { return createdAt; }
}
