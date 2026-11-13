package app.delta;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class DeltaApplication {
    public static void main(String[] args) {
        SpringApplication.run(DeltaApplication.class, args);
    }
}
