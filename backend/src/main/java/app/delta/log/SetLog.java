package app.delta.log;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "set_logs")
public class SetLog {

    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(nullable = false, length = 60)
    private String exercise;

    @Column(name = "weight_kg", nullable = false, precision = 6, scale = 2)
    private BigDecimal weightKg;

    @Column(nullable = false)
    private int reps;

    @Column(name = "performed_at", nullable = false)
    private Instant performedAt;

    protected SetLog() {}

    public SetLog(UUID id, UUID userId, String exercise, BigDecimal weightKg, int reps, Instant performedAt) {
        this.id = id;
        this.userId = userId;
        this.exercise = exercise;
        this.weightKg = weightKg;
        this.reps = reps;
        this.performedAt = performedAt;
    }

    public UUID getId() { return id; }
    public UUID getUserId() { return userId; }
    public String getExercise() { return exercise; }
    public BigDecimal getWeightKg() { return weightKg; }
    public int getReps() { return reps; }
    public Instant getPerformedAt() { return performedAt; }
}
