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

    @Column(name = "token_hash", nullable = false, unique = true, length = 64)
    private String tokenHash;

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

    @Column(precision = 4, scale = 1)
    private BigDecimal bmi;

    protected AppUser() {}

    public AppUser(UUID id, String tokenHash, Instant now, Goal goal, int daysPerWeek, int minutesPerSession) {
        this.id = id;
        this.tokenHash = tokenHash;
        this.createdAt = now;
        this.consentAt = now;
        this.goal = goal;
        this.daysPerWeek = daysPerWeek;
        this.minutesPerSession = minutesPerSession;
    }

    public UUID getId() { return id; }
    public String getTokenHash() { return tokenHash; }
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
    public BigDecimal getBmi() { return bmi; }
    public void setBmi(BigDecimal bmi) { this.bmi = bmi; }

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
