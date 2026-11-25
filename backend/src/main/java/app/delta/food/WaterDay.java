package app.delta.food;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;

import java.io.Serializable;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "water_days")
@IdClass(WaterDay.Key.class)
public class WaterDay {

    public record Key(UUID userId, LocalDate day) implements Serializable {
        public Key() { this(null, null); }
    }

    @Id
    @Column(name = "user_id")
    private UUID userId;

    @Id
    @Column(name = "log_date")
    private LocalDate day;

    @Column(nullable = false)
    private int ml;

    protected WaterDay() {}

    public WaterDay(UUID userId, LocalDate day, int ml) {
        this.userId = userId;
        this.day = day;
        this.ml = ml;
    }

    public UUID getUserId() { return userId; }
    public LocalDate getDay() { return day; }
    public int getMl() { return ml; }
    public void setMl(int ml) { this.ml = ml; }
}
