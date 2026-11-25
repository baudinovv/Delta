package app.delta.food;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;

import java.io.Serializable;
import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "recipe_ingredients")
@IdClass(RecipeIngredient.Key.class)
public class RecipeIngredient {

    public record Key(UUID recipeId, Integer position) implements Serializable {
        public Key() { this(null, null); }
    }

    @Id
    @Column(name = "recipe_id")
    private UUID recipeId;

    @Id
    private Integer position;

    @Column(name = "food_id", nullable = false)
    private UUID foodId;

    @Column(nullable = false, precision = 7, scale = 1)
    private BigDecimal grams;

    protected RecipeIngredient() {}

    public RecipeIngredient(UUID recipeId, int position, UUID foodId, BigDecimal grams) {
        this.recipeId = recipeId;
        this.position = position;
        this.foodId = foodId;
        this.grams = grams;
    }

    public UUID getRecipeId() { return recipeId; }
    public int getPosition() { return position; }
    public UUID getFoodId() { return foodId; }
    public BigDecimal getGrams() { return grams; }
}
