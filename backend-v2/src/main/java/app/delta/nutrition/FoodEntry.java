package app.delta.nutrition;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "food_entries")
public class FoodEntry {

    public enum Meal { BREAKFAST, LUNCH, DINNER, SNACK }

    public enum Source { MANUAL, PHOTO }

    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "eaten_on", nullable = false)
    private LocalDate eatenOn;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Meal meal;

    @Column(nullable = false, length = 120)
    private String name;

    private Integer grams;

    @Column(nullable = false)
    private int kcal;

    @Column(name = "protein_g", nullable = false, precision = 6, scale = 1)
    private BigDecimal proteinG;

    @Column(name = "fat_g", nullable = false, precision = 6, scale = 1)
    private BigDecimal fatG;

    @Column(name = "carbs_g", nullable = false, precision = 6, scale = 1)
    private BigDecimal carbsG;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 8)
    private Source source;

    protected FoodEntry() {}

    public FoodEntry(UUID id, UUID userId, LocalDate eatenOn, Instant createdAt, Meal meal, String name,
                     Integer grams, int kcal, BigDecimal proteinG, BigDecimal fatG, BigDecimal carbsG, Source source) {
        this.id = id;
        this.userId = userId;
        this.eatenOn = eatenOn;
        this.createdAt = createdAt;
        this.meal = meal;
        this.name = name;
        this.grams = grams;
        this.kcal = kcal;
        this.proteinG = proteinG;
        this.fatG = fatG;
        this.carbsG = carbsG;
        this.source = source;
    }

    public UUID getId() { return id; }
    public UUID getUserId() { return userId; }
    public LocalDate getEatenOn() { return eatenOn; }
    public Instant getCreatedAt() { return createdAt; }
    public Meal getMeal() { return meal; }
    public String getName() { return name; }
    public Integer getGrams() { return grams; }
    public int getKcal() { return kcal; }
    public BigDecimal getProteinG() { return proteinG; }
    public BigDecimal getFatG() { return fatG; }
    public BigDecimal getCarbsG() { return carbsG; }
    public Source getSource() { return source; }
}
