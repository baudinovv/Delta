package app.delta.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.ZoneId;
import java.util.List;

@ConfigurationProperties(prefix = "delta")
public record DeltaProperties(ZoneId zone, List<String> defaultExercises) {
    public DeltaProperties {
        if (zone == null) zone = ZoneId.of("Asia/Almaty");
        if (defaultExercises == null) defaultExercises = List.of();
    }
}
