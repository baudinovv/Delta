package app.delta.ai;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

/** Gemini settings. With no api key the app runs a demo client with canned answers. */
@ConfigurationProperties(prefix = "delta.ai")
public record AiProperties(String geminiApiKey, String model, String baseUrl, Duration timeout) {
    public AiProperties {
        if (model == null || model.isBlank()) model = "gemini-2.5-flash";
        if (baseUrl == null || baseUrl.isBlank()) baseUrl = "https://generativelanguage.googleapis.com/v1beta";
        if (timeout == null) timeout = Duration.ofSeconds(60);
    }

    public boolean hasKey() {
        return geminiApiKey != null && !geminiApiKey.isBlank();
    }
}
