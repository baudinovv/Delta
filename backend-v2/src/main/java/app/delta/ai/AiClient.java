package app.delta.ai;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.List;
import java.util.Map;

public interface AiClient {

    record Turn(boolean fromUser, String text) {}

    record Image(String mimeType, String base64) {}

    /** False for the demo client; the app shows a "demo mode" note. */
    boolean live();

    String chat(String system, List<Turn> turns);

    /** Asks for a JSON answer that matches the given schema (Gemini OpenAPI-style schema). */
    JsonNode structured(String system, String prompt, Image image, Map<String, Object> schema);
}
