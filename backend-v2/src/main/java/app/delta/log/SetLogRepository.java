package app.delta.log;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SetLogRepository extends JpaRepository<SetLog, UUID> {

    List<SetLog> findByUserIdOrderByPerformedAtAsc(UUID userId);

    List<SetLog> findByUserIdAndPerformedAtGreaterThanEqualOrderByPerformedAtAsc(UUID userId, Instant from);

    Optional<SetLog> findFirstByUserIdAndExerciseIgnoreCaseOrderByPerformedAtDesc(UUID userId, String exercise);

    Optional<SetLog> findByIdAndUserId(UUID id, UUID userId);

    @Query("select s.exercise from SetLog s where s.userId = :userId group by s.exercise order by min(s.performedAt)")
    List<String> findExercisesInFirstLoggedOrder(@Param("userId") UUID userId);
}
