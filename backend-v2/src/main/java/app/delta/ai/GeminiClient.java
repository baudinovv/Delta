package app.delta.ai;

import app.delta.common.ApiException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class GeminiClient implements AiClient {

    private static final Logger log = LoggerFactory.getLogger(GeminiClient.class);

    private final RestClient http;
    private final AiProperties props;
    private final ObjectMapper json;

    public GeminiClient(AiProperties props, ObjectMapper json) {
        this.props = props;
        this.json = json;
        var factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout((int) props.timeout().toMillis());
        factory.setReadTimeout((int) props.timeout().toMillis());
        this.http = RestClient.builder().baseUrl(props.baseUrl()).requestFactory(factory).build();
    }

    @Override
    public boolean live() {
        return true;
    }

    @Override
    public String chat(String system, List<Turn> turns) {
        List<Map<String, Object>> contents = new ArrayList<>();
        for (Turn t : turns) {
            contents.add(Map.of("role", t.fromUser() ? "user" : "model", "parts", List.of(Map.of("text", t.text()))));
        }
        return text(generate(system, contents, null));
    }

    @Override
    public JsonNode structured(String system, String prompt, Image image, Map<String, Object> schema) {
        List<Object> parts = new ArrayList<>();
        if (image != null) {
            parts.add(Map.of("inline_data", Map.of("mime_type", image.mimeType(), "data", image.base64())));
        }
        parts.add(Map.of("text", prompt));
        var config = Map.of("responseMimeType", "application/json", "responseSchema", schema);
        String raw = text(generate(system, List.of(Map.of("role", "user", "parts", parts)), config));
        try {
            return json.readTree(raw);
        } catch (Exception e) {
            log.warn("Gemini returned non-JSON: {}", raw);
            throw unavailable();
        }
    }

    private JsonNode generate(String system, List<Map<String, Object>> contents, Map<String, Object> config) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("systemInstruction", Map.of("parts", List.of(Map.of("text", system))));
        body.put("contents", contents);
        if (config != null) body.put("generationConfig", config);
        try {
            return http.post()
                    .uri("/models/{model}:generateContent", props.model())
                    .header("x-goog-api-key", props.geminiApiKey())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(JsonNode.class);
        } catch (HttpClientErrorException.TooManyRequests e) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "AI_RATE_LIMIT",
                    "The AI free quota is used up for now. Try again in a minute.");
        } catch (RestClientException e) {
            log.warn("Gemini call failed: {}", e.getMessage());
            throw unavailable();
        }
    }

    private String text(JsonNode response) {
        StringBuilder out = new StringBuilder();
        JsonNode parts = response == null ? null : response.path("candidates").path(0).path("content").path("parts");
        if (parts != null && parts.isArray()) {
            for (JsonNode p : parts) {
                if (!p.path("thought").asBoolean(false)) out.append(p.path("text").asText(""));
            }
        }
        if (out.isEmpty()) {
            log.warn("Gemini returned no text: {}", response);
            throw unavailable();
        }
        return out.toString().trim();
    }

    private static ApiException unavailable() {
        return new ApiException(HttpStatus.BAD_GATEWAY, "AI_UNAVAILABLE", "The AI didn't answer. Try again.");
    }
}
