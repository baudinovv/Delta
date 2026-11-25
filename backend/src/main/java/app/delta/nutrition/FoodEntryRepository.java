package app.delta.nutrition;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface FoodEntryRepository extends JpaRepository<FoodEntry, UUID> {

    List<FoodEntry> findByUserIdAndEatenOnOrderByCreatedAtAsc(UUID userId, LocalDate day);

    List<FoodEntry> findByUserIdAndEatenOnBetween(UUID userId, LocalDate from, LocalDate to);

    Optional<FoodEntry> findByIdAndUserId(UUID id, UUID userId);

    List<FoodEntry> findTop200ByUserIdAndFoodIdIsNotNullOrderByCreatedAtDesc(UUID userId);

    List<FoodEntry> findByUserIdAndEatenOnAndMealOrderByCreatedAtAsc(UUID userId, LocalDate day, FoodEntry.Meal meal);
}
