package app.delta.coach;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "coach_messages")
public class CoachMessage {

    public static final String USER = "user";
    public static final String COACH = "coach";

    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(nullable = false, length = 10)
    private String role;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    /** JSON list of {@link CoachTools.Action}s the coach performed for this reply, or null. */
    @Column(columnDefinition = "TEXT")
    private String actions;

    protected CoachMessage() {}

    public CoachMessage(UUID id, UUID userId, String role, String content, Instant createdAt) {
        this.id = id;
        this.userId = userId;
        this.role = role;
        this.content = content;
        this.createdAt = createdAt;
    }

    public UUID getId() { return id; }
    public UUID getUserId() { return userId; }
    public String getRole() { return role; }
    public String getContent() { return content; }
    public Instant getCreatedAt() { return createdAt; }
    public String getActions() { return actions; }
    public void setActions(String actions) { this.actions = actions; }
}
