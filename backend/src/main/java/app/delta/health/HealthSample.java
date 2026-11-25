package app.delta.health;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/** A workout or a daily total read from Apple Health / Health Connect. */
@Entity
@Table(name = "health_samples")
public class HealthSample {

    public enum Platform { IOS, ANDROID }

    public enum Kind { WORKOUT, STEPS, ACTIVE_ENERGY, HEART_RATE }

    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 8)
    private Platform platform;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Kind kind;

    @Column(name = "external_id", nullable = false, length = 128)
    private String externalId;

    @Column(name = "start_at", nullable = false)
    private Instant startAt;

    @Column(name = "end_at", nullable = false)
    private Instant endAt;

    @Column(name = "amount", precision = 10, scale = 1)
    private BigDecimal value;

    @Column(name = "workout_type", length = 40)
    private String workoutType;

    @Column(name = "energy_kcal", precision = 7, scale = 1)
    private BigDecimal energyKcal;

    @Column(name = "avg_hr")
    private Integer avgHr;

    @Column(name = "source_name", length = 80)
    private String sourceName;

    @Column(name = "from_delta", nullable = false)
    private boolean fromDelta;

    @Column(name = "synced_at", nullable = false)
    private Instant syncedAt;

    protected HealthSample() {}

    public HealthSample(UUID id, UUID userId, Platform platform, Kind kind, String externalId) {
        this.id = id;
        this.userId = userId;
        this.platform = platform;
        this.kind = kind;
        this.externalId = externalId;
    }

    public void update(Instant startAt, Instant endAt, BigDecimal value, String workoutType, BigDecimal energyKcal,
                       Integer avgHr, String sourceName, boolean fromDelta, Instant syncedAt) {
        this.startAt = startAt;
        this.endAt = endAt;
        this.value = value;
        this.workoutType = workoutType;
        this.energyKcal = energyKcal;
        this.avgHr = avgHr;
        this.sourceName = sourceName;
        this.fromDelta = fromDelta;
        this.syncedAt = syncedAt;
    }

    public UUID getId() { return id; }
    public UUID getUserId() { return userId; }
    public Platform getPlatform() { return platform; }
    public Kind getKind() { return kind; }
    public String getExternalId() { return externalId; }
    public Instant getStartAt() { return startAt; }
    public Instant getEndAt() { return endAt; }
    public BigDecimal getValue() { return value; }
    public String getWorkoutType() { return workoutType; }
    public BigDecimal getEnergyKcal() { return energyKcal; }
    public Integer getAvgHr() { return avgHr; }
    public String getSourceName() { return sourceName; }
    public boolean isFromDelta() { return fromDelta; }
    public Instant getSyncedAt() { return syncedAt; }
}
