package app.delta.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class AiConfig {
    @Bean
    public AiClient aiClient(AiProperties props, ObjectMapper json) {
        if (props.hasKey()) {
            LoggerFactory.getLogger(AiConfig.class).info("AI: Gemini model {}", props.model());
            return new GeminiClient(props, json);
        }
        LoggerFactory.getLogger(AiConfig.class).warn("AI: GEMINI_API_KEY not set, using demo answers");
        return new DemoAiClient(json);
    }
}
