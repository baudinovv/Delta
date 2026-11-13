package app.delta.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.List;
import java.util.Map;

/** Used when GEMINI_API_KEY is not set, so every screen works without a key. */
public class DemoAiClient implements AiClient {

    private final ObjectMapper json;

    public DemoAiClient(ObjectMapper json) {
        this.json = json;
    }

    @Override
    public boolean live() {
        return false;
    }

    @Override
    public String chat(String system, List<Turn> turns) {
        boolean ru = system.contains("LANG=ru");
        return ru
                ? "Демо-режим: ИИ не подключён (нет GEMINI_API_KEY на сервере). С ключом я бы ответил с учётом "
                        + "ваших тренировок и питания. Общий совет: каждую неделю добавляйте 1 повтор или 2,5 кг "
                        + "к рабочему весу и ешьте 1,6–2 г белка на кг веса."
                : "Demo mode: the AI isn't connected (no GEMINI_API_KEY on the server). With a key I'd answer "
                        + "using your workouts and meals. General tip: add one rep or 2.5 kg each week and eat "
                        + "1.6–2 g of protein per kg of body weight.";
    }

    @Override
    public JsonNode structured(String system, String prompt, Image image, Map<String, Object> schema) {
        boolean ru = system.contains("LANG=ru");
        return json.valueToTree(Map.of(
                "dish", ru ? "Курица с рисом и овощами (демо)" : "Chicken with rice and veggies (demo)",
                "confidence", "medium",
                "note", ru ? "Демо-ответ: подключите GEMINI_API_KEY для настоящего распознавания."
                        : "Demo answer: set GEMINI_API_KEY for real recognition.",
                "items", List.of(
                        Map.of("name", ru ? "Куриная грудка" : "Chicken breast", "grams", 150, "kcal", 248,
                                "proteinG", 46.5, "fatG", 5.4, "carbsG", 0),
                        Map.of("name", ru ? "Рис отварной" : "Boiled rice", "grams", 180, "kcal", 234,
                                "proteinG", 4.9, "fatG", 0.5, "carbsG", 51.5),
                        Map.of("name", ru ? "Овощи" : "Vegetables", "grams", 100, "kcal", 35,
                                "proteinG", 1.5, "fatG", 0.2, "carbsG", 7))));
    }
}
