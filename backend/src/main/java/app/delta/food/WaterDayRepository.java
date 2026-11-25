package app.delta.food;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface WaterDayRepository extends JpaRepository<WaterDay, WaterDay.Key> {
    List<WaterDay> findByUserIdAndDayBetween(UUID userId, LocalDate from, LocalDate to);
}
