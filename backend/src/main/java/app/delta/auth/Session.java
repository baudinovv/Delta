package app.delta.auth;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/** A signed-in device. Only the SHA-256 of the bearer token is stored. */
@Entity
@Table(name = "sessions")
public class Session {

    @Id
    @Column(name = "token_hash", length = 64)
    private String tokenHash;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected Session() {}

    public Session(String tokenHash, UUID userId, Instant createdAt) {
        this.tokenHash = tokenHash;
        this.userId = userId;
        this.createdAt = createdAt;
    }

    public String getTokenHash() { return tokenHash; }
    public UUID getUserId() { return userId; }
    public Instant getCreatedAt() { return createdAt; }
}
