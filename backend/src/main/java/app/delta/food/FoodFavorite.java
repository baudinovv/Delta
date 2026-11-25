package app.delta.food;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;

import java.io.Serializable;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "food_favorites")
@IdClass(FoodFavorite.Key.class)
public class FoodFavorite {

    public record Key(UUID userId, UUID foodId) implements Serializable {
        public Key() { this(null, null); }
    }

    @Id
    @Column(name = "user_id")
    private UUID userId;

    @Id
    @Column(name = "food_id")
    private UUID foodId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected FoodFavorite() {}

    public FoodFavorite(UUID userId, UUID foodId, Instant createdAt) {
        this.userId = userId;
        this.foodId = foodId;
        this.createdAt = createdAt;
    }

    public UUID getUserId() { return userId; }
    public UUID getFoodId() { return foodId; }
    public Instant getCreatedAt() { return createdAt; }
}
