package app.delta.ai;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.List;
import java.util.Map;

public interface AiClient {

    record Turn(boolean fromUser, String text) {}

    /** Inline media (photo or audio) sent with a request. */
    record Image(String mimeType, String base64) {}

    /** A function the model may call. parameters is a Gemini (OpenAPI-style) schema. */
    record Tool(String name, String description, Map<String, Object> parameters) {}

    /** Runs a tool call from the model; the returned map is sent back to the model as the result. */
    @FunctionalInterface
    interface ToolExecutor {
        Map<String, Object> call(String name, JsonNode args);
    }

    int MAX_TOOL_ROUNDS = 6;

    /** False for the demo client; the app shows a "demo mode" note. */
    boolean live();

    String chat(String system, List<Turn> turns);

    /**
     * Chat where the model may call tools (log a set, log food, save a plan…). Tool calls are executed through
     * {@code executor} and their results fed back until the model answers with text.
     */
    String chatWithTools(String system, List<Turn> turns, List<Tool> tools, ToolExecutor executor);

    /** Speech to text, in the language spoken. Empty string if nothing intelligible was said. */
    String transcribe(Image audio, String lang);

    /** Asks for a JSON answer that matches the given schema (Gemini OpenAPI-style schema). */
    JsonNode structured(String system, String prompt, Image image, Map<String, Object> schema);
}
