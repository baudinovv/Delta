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
        return text(generate(system, contents, null, null));
    }

    @Override
    public String chatWithTools(String system, List<Turn> turns, List<Tool> tools, ToolExecutor executor) {
        List<Object> contents = new ArrayList<>();
        for (Turn t : turns) {
            contents.add(Map.of("role", t.fromUser() ? "user" : "model", "parts", List.of(Map.of("text", t.text()))));
        }
        List<Map<String, Object>> declarations = tools.stream()
                .map(t -> Map.<String, Object>of("name", t.name(), "description", t.description(), "parameters", t.parameters()))
                .toList();
        Map<String, Object> extra = Map.of("tools", List.of(Map.of("functionDeclarations", declarations)));

        for (int round = 0; round < MAX_TOOL_ROUNDS; round++) {
            JsonNode response = generate(system, contents, null, extra);
            JsonNode content = response == null ? null : response.path("candidates").path(0).path("content");
            if (content == null || content.isMissingNode()) throw unavailable();
            List<JsonNode> calls = new ArrayList<>();
            for (JsonNode part : content.path("parts")) {
                if (part.has("functionCall")) calls.add(part.get("functionCall"));
            }
            if (calls.isEmpty()) return text(response);

            // Send the model's turn back unchanged: Gemini 2.5 needs its thought signatures to continue.
            contents.add(content);
            List<Object> results = new ArrayList<>();
            for (JsonNode call : calls) {
                String name = call.path("name").asText();
                Map<String, Object> result;
                try {
                    result = executor.call(name, call.path("args"));
                } catch (ApiException e) {
                    result = Map.of("error", e.getMessage());
                } catch (RuntimeException e) {
                    log.warn("Tool {} failed", name, e);
                    result = Map.of("error", "Could not do that.");
                }
                results.add(Map.of("functionResponse", Map.of("name", name, "response", result)));
            }
            contents.add(Map.of("role", "user", "parts", results));
        }
        throw unavailable();
    }

    @Override
    public String transcribe(Image audio, String lang) {
        String system = "You transcribe short voice messages to a fitness app. Output only the exact words spoken, "
                + "in the language spoken (usually " + ("ru".equals(lang) ? "Russian" : "English")
                + "), with normal punctuation and digits for numbers. If there is no intelligible speech, output nothing.";
        List<Object> parts = List.of(
                Map.of("inline_data", Map.of("mime_type", audio.mimeType(), "data", audio.base64())),
                Map.of("text", "Transcribe this."));
        JsonNode r = generate(system, List.of(Map.of("role", "user", "parts", parts)), null, null);
        JsonNode p = r == null ? null : r.path("candidates").path(0).path("content").path("parts");
        StringBuilder out = new StringBuilder();
        if (p != null && p.isArray()) for (JsonNode x : p) if (!x.path("thought").asBoolean(false)) out.append(x.path("text").asText(""));
        return out.toString().trim();
    }

    @Override
    public JsonNode structured(String system, String prompt, Image image, Map<String, Object> schema) {
        List<Object> parts = new ArrayList<>();
        if (image != null) {
            parts.add(Map.of("inline_data", Map.of("mime_type", image.mimeType(), "data", image.base64())));
        }
        parts.add(Map.of("text", prompt));
        var config = Map.of("responseMimeType", "application/json", "responseSchema", schema);
        String raw = text(generate(system, List.of(Map.of("role", "user", "parts", parts)), config, null));
        try {
            return json.readTree(raw);
        } catch (Exception e) {
            log.warn("Gemini returned non-JSON: {}", raw);
            throw unavailable();
        }
    }

    private JsonNode generate(String system, List<?> contents, Map<String, Object> config, Map<String, Object> extra) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("systemInstruction", Map.of("parts", List.of(Map.of("text", system))));
        body.put("contents", contents);
        if (config != null) body.put("generationConfig", config);
        if (extra != null) body.putAll(extra);
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
