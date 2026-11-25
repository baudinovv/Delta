package app.delta.health;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface HealthSampleRepository extends JpaRepository<HealthSample, UUID> {

    List<HealthSample> findByUserIdAndPlatformAndExternalIdIn(UUID userId, HealthSample.Platform platform,
                                                              Collection<String> externalIds);

    List<HealthSample> findByUserIdAndStartAtGreaterThanEqualOrderByStartAtAsc(UUID userId, Instant from);

    long countByUserId(UUID userId);

    @Modifying
    @Query("delete from HealthSample s where s.userId = :userId")
    int deleteAllForUser(@Param("userId") UUID userId);
}
