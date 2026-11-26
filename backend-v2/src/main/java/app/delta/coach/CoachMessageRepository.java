package app.delta.coach;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface CoachMessageRepository extends JpaRepository<CoachMessage, UUID> {

    List<CoachMessage> findByUserIdOrderByCreatedAtDesc(UUID userId, Pageable page);

    @Modifying
    @Query("delete from CoachMessage m where m.userId = :userId")
    void deleteAllForUser(@Param("userId") UUID userId);
}
