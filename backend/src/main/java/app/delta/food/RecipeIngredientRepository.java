package app.delta.food;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface RecipeIngredientRepository extends JpaRepository<RecipeIngredient, RecipeIngredient.Key> {
    List<RecipeIngredient> findByRecipeIdOrderByPosition(UUID recipeId);

    boolean existsByFoodId(UUID foodId);
}
