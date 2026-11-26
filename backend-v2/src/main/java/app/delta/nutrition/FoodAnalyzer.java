package app.delta.nutrition;

import app.delta.ai.AiClient;
import app.delta.common.ApiException;
import app.delta.nutrition.NutritionDtos.AnalyzeRequest;
import app.delta.nutrition.NutritionDtos.AnalyzedItem;
import app.delta.nutrition.NutritionDtos.Analysis;
import app.delta.nutrition.NutritionDtos.Totals;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/** Estimates calories and macros of a dish from a photo. */
@Service
public class FoodAnalyzer {

    private static final Map<String, Object> SCHEMA = Map.of(
            "type", "OBJECT",
            "properties", Map.of(
                    "isFood", Map.of("type", "BOOLEAN"),
                    "dish", Map.of("type", "STRING"),
                    "confidence", Map.of("type", "STRING", "enum", List.of("low", "medium", "high")),
                    "note", Map.of("type", "STRING"),
                    "items", Map.of("type", "ARRAY", "items", Map.of(
                            "type", "OBJECT",
                            "properties", Map.of(
                                    "name", Map.of("type", "STRING"),
                                    "grams", Map.of("type", "INTEGER"),
                                    "kcal", Map.of("type", "INTEGER"),
                                    "proteinG", Map.of("type", "NUMBER"),
                                    "fatG", Map.of("type", "NUMBER"),
                                    "carbsG", Map.of("type", "NUMBER")),
                            "required", List.of("name", "grams", "kcal", "proteinG", "fatG", "carbsG")))),
            "required", List.of("isFood", "dish", "confidence", "items"));

    private final AiClient ai;

    public FoodAnalyzer(AiClient ai) {
        this.ai = ai;
    }

    public Analysis analyze(AnalyzeRequest req) {
        String lang = req.lang() == null ? "en" : req.lang();
        String system = """
                You are a nutritionist estimating food from a photo. LANG=%s
                Identify every distinct food on the plate, estimate each portion's weight in grams from visual
                cues (plate size ~26 cm, cutlery, hands), then calories, protein, fat and carbs for that portion
                using standard nutrition tables. Count visible oil, sauces and dressings.
                Write dish, item names and note in %s. note: one short sentence on what could change the
                estimate (hidden oil, portion size). If the photo shows no food, set isFood=false and items=[].
                """.formatted(lang, "ru".equals(lang) ? "Russian" : "English");
        String prompt = req.hint() == null || req.hint().isBlank()
                ? "Estimate this meal."
                : "Estimate this meal. The user adds: " + req.hint();

        String base64 = stripDataUrl(req.imageBase64());
        String mime = req.mimeType() == null ? "image/jpeg" : req.mimeType();
        JsonNode r = ai.structured(system, prompt, new AiClient.Image(mime, base64), SCHEMA);

        List<AnalyzedItem> items = new ArrayList<>();
        for (JsonNode i : r.path("items")) {
            int kcal = Math.max(0, i.path("kcal").asInt());
            items.add(new AnalyzedItem(i.path("name").asText("?"), i.path("grams").asInt(), kcal,
                    grams(i.path("proteinG")), grams(i.path("fatG")), grams(i.path("carbsG"))));
        }
        boolean food = r.path("isFood").asBoolean(true) && !items.isEmpty();
        return new Analysis(food, r.path("dish").asText(""), items, totals(items),
                r.path("confidence").asText("medium"), r.path("note").asText(null), !ai.live());
    }

    private static String stripDataUrl(String s) {
        int comma = s.indexOf(',');
        String b64 = s.startsWith("data:") && comma > 0 ? s.substring(comma + 1) : s;
        if (b64.length() < 100) throw ApiException.badRequest("BAD_IMAGE", "The photo is empty.");
        return b64;
    }

    private static BigDecimal grams(JsonNode n) {
        return BigDecimal.valueOf(Math.max(0, n.asDouble())).setScale(1, RoundingMode.HALF_UP);
    }

    private static Totals totals(List<AnalyzedItem> items) {
        int k = 0;
        double p = 0, f = 0, c = 0;
        for (AnalyzedItem i : items) {
            k += i.kcal();
            p += i.proteinG().doubleValue();
            f += i.fatG().doubleValue();
            c += i.carbsG().doubleValue();
        }
        return new Totals(k, (int) Math.round(p), (int) Math.round(f), (int) Math.round(c));
    }
}
