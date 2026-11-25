package app.delta.food;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface FoodFavoriteRepository extends JpaRepository<FoodFavorite, FoodFavorite.Key> {

    List<FoodFavorite> findByUserIdOrderByCreatedAtDesc(UUID userId);

    List<FoodFavorite> findByUserIdAndFoodIdIn(UUID userId, Collection<UUID> foodIds);
}
