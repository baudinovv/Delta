package app.delta.onboarding;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "users")
public class AppUser {

    @Id
    private UUID id;

    @Column(length = 254, unique = true)
    private String email;

    @Column(name = "password_hash", length = 100)
    private String passwordHash;

    @Column(length = 40)
    private String name;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "consent_at", nullable = false)
    private Instant consentAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private Goal goal;

    @Column(name = "days_per_week", nullable = false)
    private int daysPerWeek;

    @Column(name = "minutes_per_session", nullable = false)
    private int minutesPerSession;

    @Column(length = 8)
    private String sex;

    @Column(name = "birth_year")
    private Integer birthYear;

    @Column(name = "height_cm")
    private Integer heightCm;

    @Column(name = "weight_kg", precision = 5, scale = 1)
    private BigDecimal weightKg;

    @Column(name = "calorie_target")
    private Integer calorieTarget;

    @Column(name = "health_consent_at")
    private Instant healthConsentAt;

    @Column(name = "health_synced_at")
    private Instant healthSyncedAt;

    protected AppUser() {}

    public AppUser(UUID id, String email, String passwordHash, String name, Instant now,
                   Goal goal, int daysPerWeek, int minutesPerSession) {
        this.id = id;
        this.email = email;
        this.passwordHash = passwordHash;
        this.name = name;
        this.createdAt = now;
        this.consentAt = now;
        this.goal = goal;
        this.daysPerWeek = daysPerWeek;
        this.minutesPerSession = minutesPerSession;
    }

    public UUID getId() { return id; }
    public String getEmail() { return email; }
    public String getPasswordHash() { return passwordHash; }
    public String getName() { return name; }

    public void setName(String name) { this.name = name; }
    public Instant getHealthConsentAt() { return healthConsentAt; }
    public Instant getHealthSyncedAt() { return healthSyncedAt; }
    public void setHealthConsentAt(Instant at) { this.healthConsentAt = at; }
    public void setHealthSyncedAt(Instant at) { this.healthSyncedAt = at; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getConsentAt() { return consentAt; }
    public Goal getGoal() { return goal; }
    public int getDaysPerWeek() { return daysPerWeek; }
    public int getMinutesPerSession() { return minutesPerSession; }
    public String getSex() { return sex; }
    public Integer getBirthYear() { return birthYear; }
    public Integer getHeightCm() { return heightCm; }
    public BigDecimal getWeightKg() { return weightKg; }
    public Integer getCalorieTarget() { return calorieTarget; }

    public void updatePlan(Goal goal, int daysPerWeek, int minutesPerSession) {
        this.goal = goal;
        this.daysPerWeek = daysPerWeek;
        this.minutesPerSession = minutesPerSession;
    }

    public void updateBody(String sex, Integer birthYear, Integer heightCm, BigDecimal weightKg, Integer calorieTarget) {
        this.sex = sex;
        this.birthYear = birthYear;
        this.heightCm = heightCm;
        this.weightKg = weightKg;
        this.calorieTarget = calorieTarget;
    }
}
