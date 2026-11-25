package app.delta.food;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/** A food in the catalog. Nutrition is per 100 g; servings is a JSON list of named portions. */
@Entity
@Table(name = "foods")
public class Food {

    public enum Source { BUILTIN, OFF, CUSTOM, RECIPE }

    @Id
    private UUID id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 8)
    private Source source;

    @Column(name = "external_id", length = 64)
    private String externalId;

    @Column(name = "owner_id")
    private UUID ownerId;

    @Column(length = 14)
    private String barcode;

    @Column(name = "name_ru", nullable = false, length = 160)
    private String nameRu;

    @Column(name = "name_en", nullable = false, length = 160)
    private String nameEn;

    @Column(length = 120)
    private String brand;

    @Column(nullable = false, precision = 6, scale = 1)
    private BigDecimal kcal;

    @Column(name = "protein_g", nullable = false, precision = 6, scale = 2)
    private BigDecimal proteinG;

    @Column(name = "fat_g", nullable = false, precision = 6, scale = 2)
    private BigDecimal fatG;

    @Column(name = "carbs_g", nullable = false, precision = 6, scale = 2)
    private BigDecimal carbsG;

    @Column(name = "fiber_g", precision = 6, scale = 2)
    private BigDecimal fiberG;

    @Column(name = "sugar_g", precision = 6, scale = 2)
    private BigDecimal sugarG;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String servings;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected Food() {}

    public Food(UUID id, Source source, String externalId, UUID ownerId, Instant createdAt) {
        this.id = id;
        this.source = source;
        this.externalId = externalId;
        this.ownerId = ownerId;
        this.createdAt = createdAt;
        this.servings = "[]";
    }

    public void describe(String nameRu, String nameEn, String brand, String barcode) {
        this.nameRu = nameRu;
        this.nameEn = nameEn;
        this.brand = brand;
        this.barcode = barcode;
    }

    public void setNutrition(BigDecimal kcal, BigDecimal proteinG, BigDecimal fatG, BigDecimal carbsG,
                             BigDecimal fiberG, BigDecimal sugarG) {
        this.kcal = kcal;
        this.proteinG = proteinG;
        this.fatG = fatG;
        this.carbsG = carbsG;
        this.fiberG = fiberG;
        this.sugarG = sugarG;
    }

    public void setServingsJson(String servings) { this.servings = servings; }

    public UUID getId() { return id; }
    public Source getSource() { return source; }
    public String getExternalId() { return externalId; }
    public UUID getOwnerId() { return ownerId; }
    public String getBarcode() { return barcode; }
    public String getNameRu() { return nameRu; }
    public String getNameEn() { return nameEn; }
    public String getBrand() { return brand; }
    public BigDecimal getKcal() { return kcal; }
    public BigDecimal getProteinG() { return proteinG; }
    public BigDecimal getFatG() { return fatG; }
    public BigDecimal getCarbsG() { return carbsG; }
    public BigDecimal getFiberG() { return fiberG; }
    public BigDecimal getSugarG() { return sugarG; }
    public String getServingsJson() { return servings; }
    public Instant getCreatedAt() { return createdAt; }

    public String name(String lang) {
        return "en".equals(lang) ? nameEn : nameRu;
    }

    public boolean visibleTo(UUID userId) {
        return ownerId == null || ownerId.equals(userId);
    }
}
