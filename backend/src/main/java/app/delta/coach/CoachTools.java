package app.delta.coach;

import app.delta.ai.AiClient;
import app.delta.common.ApiException;
import app.delta.config.DeltaProperties;
import app.delta.food.FoodService;
import app.delta.log.LogDtos.LoggedSet;
import app.delta.log.LogDtos.NewSet;
import app.delta.log.LogService;
import app.delta.log.SetLogRepository;
import app.delta.nutrition.FoodEntry;
import app.delta.nutrition.NutritionDtos.Entry;
import app.delta.nutrition.NutritionDtos.NewEntries;
import app.delta.nutrition.NutritionDtos.NewEntry;
import app.delta.nutrition.NutritionService;
import app.delta.onboarding.AppUser;
import app.delta.onboarding.UserRepository;
import app.delta.plan.PlanService;
import app.delta.plan.PlanService.PlanDay;
import app.delta.plan.PlanService.PlannedExercise;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * Functions the AI coach can call. Every call goes through the normal services (same validation as the app),
 * and every change is recorded as an {@link Action} so the app can show it and offer undo.
 */
@Component
public class CoachTools {

    /** Something the coach did. ids/ml/date let the app undo it. */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Action(String type, String label, List<String> ids, Integer ml, String date) {}

    private static final Map<String, String> RU_NAMES =
            Map.of("Squat", "Присед", "Bench Press", "Жим лёжа", "Seated Row", "Тяга сидя");

    private static final Map<String, Object> STRING = Map.of("type", "STRING");
    private static final Map<String, Object> NUMBER = Map.of("type", "NUMBER");
    private static final Map<String, Object> INTEGER = Map.of("type", "INTEGER");

    private final LogService log;
    private final SetLogRepository sets;
    private final NutritionService nutrition;
    private final FoodService foods;
    private final PlanService plans;
    private final UserRepository users;
    private final DeltaProperties props;

    public CoachTools(LogService log, SetLogRepository sets, NutritionService nutrition, FoodService foods,
                      PlanService plans, UserRepository users, DeltaProperties props) {
        this.log = log;
        this.sets = sets;
        this.nutrition = nutrition;
        this.foods = foods;
        this.plans = plans;
        this.users = users;
        this.props = props;
    }

    public List<AiClient.Tool> tools() {
        return List.of(
                new AiClient.Tool("log_sets",
                        "Log strength sets the user did TODAY. One call per exercise. Reuse the exact exercise name "
                                + "from 'Known exercises' when it is the same movement. weightKg 0 for bodyweight.",
                        object(Map.of(
                                "exercise", STRING,
                                "sets", Map.of("type", "ARRAY", "items", object(Map.of("weightKg", NUMBER, "reps", INTEGER),
                                        List.of("weightKg", "reps")))), List.of("exercise", "sets"))),
                new AiClient.Tool("log_food",
                        "Log food into the diary. Always give your best estimate of grams, kcal and macros for the "
                                + "portion eaten; the server uses the Delta food database instead when the name matches. "
                                + "Use simple dish names in the user's language (e.g. 'Гречка отварная', 'Плов'). "
                                + "meal: BREAKFAST, LUNCH, DINNER or SNACK. date: YYYY-MM-DD, omit for today.",
                        object(Map.of(
                                "meal", Map.of("type", "STRING", "enum", List.of("BREAKFAST", "LUNCH", "DINNER", "SNACK")),
                                "date", STRING,
                                "items", Map.of("type", "ARRAY", "items", object(Map.of(
                                                "name", STRING, "grams", NUMBER, "kcal", NUMBER,
                                                "proteinG", NUMBER, "fatG", NUMBER, "carbsG", NUMBER),
                                        List.of("name", "grams", "kcal", "proteinG", "fatG", "carbsG")))),
                                List.of("meal", "items"))),
                new AiClient.Tool("add_water", "Add water the user drank, in ml (negative to correct a mistake).",
                        object(Map.of("ml", INTEGER), List.of("ml"))),
                new AiClient.Tool("update_weight", "Save the user's current body weight in kg.",
                        object(Map.of("weightKg", NUMBER), List.of("weightKg"))),
                new AiClient.Tool("save_workout_plan",
                        "Save a weekly workout plan for the user (replaces the previous one). weekday: 1 = Monday … "
                                + "7 = Sunday. Match the number of days to the user's days per week and fit each day in "
                                + "their minutes per session. reps like '8-10'. weightKg: suggested working weight from "
                                + "their recent sets, omit if unknown. note: one short cue, optional.",
                        object(Map.of(
                                "title", STRING,
                                "days", Map.of("type", "ARRAY", "items", object(Map.of(
                                        "weekday", INTEGER,
                                        "focus", STRING,
                                        "exercises", Map.of("type", "ARRAY", "items", object(Map.of(
                                                        "name", STRING, "sets", INTEGER, "reps", STRING,
                                                        "weightKg", NUMBER, "note", STRING),
                                                List.of("name", "sets", "reps")))),
                                        List.of("weekday", "focus", "exercises")))),
                                List.of("title", "days"))),
                new AiClient.Tool("get_day",
                        "Read what the user ate and which sets they logged on a date (YYYY-MM-DD).",
                        object(Map.of("date", STRING), List.of("date"))));
    }

    /** A fresh executor for one coach reply; collects the actions it performed. */
    public Run run(UUID userId, String lang) {
        return new Run(userId, "en".equals(lang) ? "en" : "ru");
    }

    public final class Run implements AiClient.ToolExecutor {
        private final UUID userId;
        private final String lang;
        private final List<Action> actions = new ArrayList<>();

        private Run(UUID userId, String lang) {
            this.userId = userId;
            this.lang = lang;
        }

        public List<Action> actions() {
            return actions;
        }

        @Override
        public Map<String, Object> call(String name, JsonNode args) {
            return switch (name) {
                case "log_sets" -> logSets(args);
                case "log_food" -> logFood(args);
                case "add_water" -> addWater(args);
                case "update_weight" -> updateWeight(args);
                case "save_workout_plan" -> savePlan(args);
                case "get_day" -> getDay(args);
                default -> Map.of("error", "Unknown function " + name);
            };
        }

        private Map<String, Object> logSets(JsonNode a) {
            String exercise = a.path("exercise").asText("").trim();
            if (exercise.isEmpty() || exercise.length() > 60) throw bad("exercise name is required");
            JsonNode list = a.path("sets");
            if (!list.isArray() || list.isEmpty() || list.size() > 20) throw bad("give 1 to 20 sets");
            List<String> ids = new ArrayList<>();
            List<String> parts = new ArrayList<>();
            String saved = exercise;
            for (JsonNode s : list) {
                double w = s.path("weightKg").asDouble(-1);
                int reps = s.path("reps").asInt(0);
                if (w < 0 || w > 1000) throw bad("weightKg must be 0 to 1000");
                LoggedSet set = log.logSet(userId, new NewSet(exercise, BigDecimal.valueOf(w), reps));
                ids.add(set.id().toString());
                saved = set.exercise();
                parts.add(fmt(w) + "×" + reps);
            }
            actions.add(new Action("SET", display(saved) + ": " + String.join(", ", parts) + (ru() ? " кг" : " kg"), ids,
                    null, null));
            return Map.of("logged", Map.of("exercise", saved, "sets", parts.size()));
        }

        private Map<String, Object> logFood(JsonNode a) {
            FoodEntry.Meal meal;
            try {
                meal = FoodEntry.Meal.valueOf(a.path("meal").asText("").toUpperCase(Locale.ROOT));
            } catch (IllegalArgumentException e) {
                throw bad("meal must be BREAKFAST, LUNCH, DINNER or SNACK");
            }
            LocalDate date = date(a.path("date"));
            JsonNode items = a.path("items");
            if (!items.isArray() || items.isEmpty() || items.size() > 15) throw bad("give 1 to 15 items");
            List<String> ids = new ArrayList<>();
            List<Map<String, Object>> logged = new ArrayList<>();
            List<String> names = new ArrayList<>();
            int total = 0;
            for (JsonNode i : items) {
                String name = i.path("name").asText("").trim();
                int grams = (int) Math.round(i.path("grams").asDouble(0));
                if (name.isEmpty() || grams <= 0 || grams > 5000) throw bad("each item needs a name and grams (1–5000)");
                NewEntry entry = catalogEntry(name, grams);
                boolean fromCatalog = entry != null;
                if (entry == null) {
                    int kcal = (int) Math.round(i.path("kcal").asDouble(-1));
                    if (kcal < 0 || kcal > 10000) throw bad("kcal estimate is required for " + name);
                    entry = new NewEntry(null, name.length() > 120 ? name.substring(0, 120) : name, grams, kcal,
                            macro(i, "proteinG"), macro(i, "fatG"), macro(i, "carbsG"), null, null);
                }
                List<Entry> saved = nutrition.add(userId, new NewEntries(date, meal, FoodEntry.Source.MANUAL, lang, List.of(entry)));
                for (Entry e : saved) {
                    ids.add(e.id().toString());
                    total += e.kcal();
                    names.add(e.name() + " " + grams + (ru() ? " г" : " g"));
                    logged.add(Map.of("name", e.name(), "grams", grams, "kcal", e.kcal(), "fromDatabase", fromCatalog));
                }
            }
            String mealName = ru() ? switch (meal) {
                case BREAKFAST -> "Завтрак";
                case LUNCH -> "Обед";
                case DINNER -> "Ужин";
                case SNACK -> "Перекус";
            } : meal.name().charAt(0) + meal.name().substring(1).toLowerCase(Locale.ROOT);
            actions.add(new Action("FOOD", mealName + ": " + String.join(", ", names) + " · " + total
                    + (ru() ? " ккал" : " kcal"), ids, null, date == null ? null : date.toString()));
            return Map.of("logged", logged, "totalKcal", total);
        }

        /** Uses the catalog when its top hit clearly is the same food (name starts with the query or vice versa). */
        private NewEntry catalogEntry(String name, int grams) {
            String q = name.toLowerCase(Locale.ROOT).replace('ё', 'е');
            var hits = foods.search(userId, name, lang, false).local();
            if (hits.isEmpty() || hits.get(0).id() == null) return null;
            String hit = hits.get(0).name().toLowerCase(Locale.ROOT).replace('ё', 'е');
            if (!hit.startsWith(q) && !q.startsWith(hit)) return null;
            return new NewEntry(hits.get(0).id(), null, grams, null, null, null, null, null, null);
        }

        private Map<String, Object> addWater(JsonNode a) {
            int ml = a.path("ml").asInt(0);
            if (ml == 0 || ml < -5000 || ml > 5000) throw bad("ml must be -5000 to 5000, not 0");
            var w = nutrition.addWater(userId, null, ml);
            actions.add(new Action("WATER", (ru() ? "Вода " : "Water ") + (ml > 0 ? "+" : "") + ml + (ru() ? " мл" : " ml"),
                    null, ml, w.date().toString()));
            return Map.of("todayMl", w.ml(), "targetMl", w.targetMl());
        }

        private Map<String, Object> updateWeight(JsonNode a) {
            double kg = a.path("weightKg").asDouble(0);
            if (kg < 30 || kg > 300) throw bad("weightKg must be 30 to 300");
            AppUser u = users.findById(userId).orElseThrow(ApiException::unauthorized);
            BigDecimal before = u.getWeightKg();
            BigDecimal now = BigDecimal.valueOf(kg).setScale(1, RoundingMode.HALF_UP);
            u.updateBody(u.getSex(), u.getBirthYear(), u.getHeightCm(), now, u.getCalorieTarget());
            users.save(u);
            actions.add(new Action("WEIGHT", (ru() ? "Вес: " : "Weight: ")
                    + (before != null ? before.stripTrailingZeros().toPlainString() + " → " : "")
                    + now.stripTrailingZeros().toPlainString() + (ru() ? " кг" : " kg"), null, null, null));
            return Map.of("weightKg", now);
        }

        private Map<String, Object> savePlan(JsonNode a) {
            List<PlanDay> days = new ArrayList<>();
            for (JsonNode d : a.path("days")) {
                List<PlannedExercise> ex = new ArrayList<>();
                for (JsonNode e : d.path("exercises")) {
                    BigDecimal w = e.hasNonNull("weightKg") && e.path("weightKg").asDouble() > 0
                            ? BigDecimal.valueOf(e.path("weightKg").asDouble()).setScale(1, RoundingMode.HALF_UP) : null;
                    ex.add(new PlannedExercise(e.path("name").asText("").trim(), e.path("sets").asInt(0),
                            e.path("reps").asText("").trim(), w, e.hasNonNull("note") ? e.path("note").asText() : null));
                }
                days.add(new PlanDay(d.path("weekday").asInt(0), d.path("focus").asText("").trim(), ex));
            }
            var plan = plans.save(userId, a.path("title").asText(""), days);
            actions.add(new Action("PLAN", (ru() ? "План: " : "Plan: ") + plan.title() + " · " + plan.days().size()
                    + (ru() ? " дн./нед." : " days/week"), null, null, null));
            return Map.of("saved", true, "days", plan.days().size());
        }

        private Map<String, Object> getDay(JsonNode a) {
            LocalDate date = date(a.path("date"));
            LocalDate d = date == null ? nutrition.today() : date;
            var day = nutrition.day(userId, d);
            List<Map<String, Object>> food = day.entries().stream()
                    .map(e -> Map.<String, Object>of("meal", e.meal().name(), "name", e.name(), "kcal", e.kcal())).toList();
            var zone = props.zone();
            List<String> setList = sets.findByUserIdAndPerformedAtGreaterThanEqualOrderByPerformedAtAsc(userId,
                            d.atStartOfDay(zone).toInstant()).stream()
                    .filter(s -> s.getPerformedAt().atZone(zone).toLocalDate().equals(d))
                    .map(s -> s.getExercise() + " " + s.getWeightKg().stripTrailingZeros().toPlainString() + "x" + s.getReps())
                    .toList();
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("date", d.toString());
            out.put("totalKcal", day.totals().kcal());
            out.put("food", food);
            out.put("sets", setList);
            out.put("waterMl", day.waterMl());
            return out;
        }

        private boolean ru() {
            return "ru".equals(lang);
        }

        /** The default exercises are stored in English; the app shows them translated, so labels do too. */
        private String display(String exercise) {
            return ru() ? RU_NAMES.getOrDefault(exercise, exercise) : exercise;
        }
    }

    private static Map<String, Object> object(Map<String, Object> properties, List<String> required) {
        return Map.of("type", "OBJECT", "properties", properties, "required", required);
    }

    private static LocalDate date(JsonNode n) {
        if (n == null || n.isMissingNode() || n.isNull() || n.asText().isBlank()) return null;
        try {
            return LocalDate.parse(n.asText().trim());
        } catch (DateTimeParseException e) {
            throw bad("date must be YYYY-MM-DD");
        }
    }

    private static BigDecimal macro(JsonNode i, String field) {
        double v = i.path(field).asDouble(0);
        return BigDecimal.valueOf(Math.max(0, Math.min(1000, v))).setScale(1, RoundingMode.HALF_UP);
    }

    private static String fmt(double w) {
        return w == Math.rint(w) ? String.valueOf((long) w) : String.valueOf(w);
    }

    private static ApiException bad(String message) {
        return ApiException.badRequest("BAD_TOOL_ARGS", message);
    }
}
