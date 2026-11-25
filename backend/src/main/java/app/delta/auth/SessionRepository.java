package app.delta.auth;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.UUID;

public interface SessionRepository extends JpaRepository<Session, String> {

    @Modifying
    @Query("delete from Session s where s.userId = :userId and s.tokenHash <> :keep")
    int deleteOthers(@Param("userId") UUID userId, @Param("keep") String keepTokenHash);
}
