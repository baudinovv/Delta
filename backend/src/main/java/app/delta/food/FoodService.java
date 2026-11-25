package app.delta.food;

import app.delta.common.ApiException;
import app.delta.food.FoodDtos.FoodDto;
import app.delta.food.FoodDtos.Ingredient;
import app.delta.food.FoodDtos.NewFood;
import app.delta.food.FoodDtos.NewRecipe;
import app.delta.food.FoodDtos.Per100;
import app.delta.food.FoodDtos.RecentFood;
import app.delta.food.FoodDtos.SearchResult;
import app.delta.food.FoodDtos.ServingDto;
import app.delta.nutrition.FoodEntry;
import app.delta.nutrition.FoodEntryRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class FoodService {

    private static final int LOCAL_LIMIT = 30;

    private final FoodRepository foods;
    private final FoodFavoriteRepository favorites;
    private final RecipeIngredientRepository ingredients;
    private final FoodEntryRepository entries;
    private final OpenFoodFactsClient off;
    private final ObjectMapper json;
    private final Clock clock;

    public FoodService(FoodRepository foods, FoodFavoriteRepository favorites, RecipeIngredientRepository ingredients,
                       FoodEntryRepository entries, OpenFoodFactsClient off, ObjectMapper json, Clock clock) {
        this.foods = foods;
        this.favorites = favorites;
        this.ingredients = ingredients;
        this.entries = entries;
        this.off = off;
        this.json = json;
        this.clock = clock;
    }

    /* ---------- reading ---------- */

    @Transactional(readOnly = true)
    public SearchResult search(UUID userId, String rawQuery, String lang, boolean online) {
        String q = normalize(rawQuery);
        if (q.length() < 2) return new SearchResult(List.of(), online ? List.of() : null);

        List<Food> found = foods.search(userId, "%" + q + "%", PageRequest.of(0, 200));
        List<Food> ranked = found.stream()
                .sorted(Comparator.comparingInt((Food f) -> rank(f, q, userId)).thenComparing(f -> f.name(lang).length()))
                .limit(LOCAL_LIMIT)
                .toList();
        List<FoodDto> local = toDtos(ranked, userId, lang);

        List<FoodDto> remote = null;
        if (online) {
            Set<String> localBarcodes = ranked.stream().map(Food::getBarcode).filter(b -> b != null)
                    .collect(Collectors.toSet());
            remote = off.search(rawQuery.trim()).stream()
                    .filter(p -> !localBarcodes.contains(p.barcode()))
                    .map(p -> fromOff(p, lang))
                    .toList();
        }
        return new SearchResult(local, remote);
    }

    @Transactional(readOnly = true)
    public FoodDto get(UUID userId, UUID foodId, String lang) {
        Food f = visible(userId, foodId);
        FoodDto dto = toDtos(List.of(f), userId, lang).get(0);
        if (f.getSource() != Food.Source.RECIPE) return dto;
        List<Ingredient> list = new ArrayList<>();
        for (RecipeIngredient ri : ingredients.findByRecipeIdOrderByPosition(f.getId())) {
            foods.findById(ri.getFoodId()).ifPresent(i -> list.add(new Ingredient(i.getId(), i.name(lang), ri.getGrams(),
                    (int) Math.round(i.getKcal().doubleValue() * ri.getGrams().doubleValue() / 100))));
        }
        return new FoodDto(dto.id(), dto.source(), dto.barcode(), dto.name(), dto.brand(), dto.per100(), dto.servings(),
                dto.favorite(), dto.own(), list);
    }

    /** Own foods first, then the shared catalog, then Open Food Facts (imported into the catalog on first use). */
    @Transactional
    public FoodDto byBarcode(UUID userId, String rawBarcode, String lang) {
        String barcode = rawBarcode.replaceAll("\\D", "");
        if (barcode.length() < 8 || barcode.length() > 14) {
            throw ApiException.badRequest("BAD_BARCODE", "Barcode must have 8–14 digits.");
        }
        List<Food> known = foods.findByBarcode(userId, barcode);
        if (!known.isEmpty()) {
            Food best = known.stream().filter(f -> userId.equals(f.getOwnerId())).findFirst().orElse(known.get(0));
            return get(userId, best.getId(), lang);
        }
        var product = off.byBarcode(barcode).orElseThrow(() ->
                new ApiException(HttpStatus.NOT_FOUND, "BARCODE_NOT_FOUND", "No product with this barcode yet."));
        Food f = foods.findBySourceAndExternalId(Food.Source.OFF, product.barcode())
                .orElseGet(() -> new Food(UUID.randomUUID(), Food.Source.OFF, product.barcode(), null, Instant.now(clock)));
        f.describe(cut(product.nameRu()), cut(product.nameEn()), product.brand(), product.barcode());
        f.setNutrition(round(product.kcal(), 1), round(product.protein(), 2), round(product.fat(), 2),
                round(product.carbs(), 2), product.fiber() == null ? null : round(product.fiber(), 2),
                product.sugar() == null ? null : round(product.sugar(), 2));
        f.setServingsJson(write(product.servings()));
        foods.save(f);
        return get(userId, f.getId(), lang);
    }

    @Transactional(readOnly = true)
    public List<FoodDto> favorites(UUID userId, String lang) {
        List<UUID> ids = favorites.findByUserIdOrderByCreatedAtDesc(userId).stream().map(FoodFavorite::getFoodId).toList();
        Map<UUID, Food> byId = foods.findAllById(ids).stream().collect(Collectors.toMap(Food::getId, f -> f));
        return toDtos(ids.stream().map(byId::get).filter(f -> f != null).toList(), userId, lang);
    }

    /** Foods the user logged lately, newest first, with the portion they used last time. */
    @Transactional(readOnly = true)
    public List<RecentFood> recent(UUID userId, String lang) {
        Map<UUID, FoodEntry> latest = new LinkedHashMap<>();
        for (FoodEntry e : entries.findTop200ByUserIdAndFoodIdIsNotNullOrderByCreatedAtDesc(userId)) {
            latest.putIfAbsent(e.getFoodId(), e);
            if (latest.size() >= 30) break;
        }
        Map<UUID, Food> byId = foods.findAllById(latest.keySet()).stream()
                .filter(f -> f.visibleTo(userId)).collect(Collectors.toMap(Food::getId, f -> f));
        List<Food> ordered = latest.keySet().stream().map(byId::get).filter(f -> f != null).toList();
        List<FoodDto> dtos = toDtos(ordered, userId, lang);
        List<RecentFood> out = new ArrayList<>();
        for (int i = 0; i < ordered.size(); i++) {
            FoodEntry e = latest.get(ordered.get(i).getId());
            out.add(new RecentFood(dtos.get(i), e.getServingLabel(),
                    e.getGrams() == null ? null : BigDecimal.valueOf(e.getGrams()), e.getServingsCount()));
        }
        return out;
    }

    @Transactional(readOnly = true)
    public List<FoodDto> mine(UUID userId, String lang) {
        return toDtos(foods.findByOwnerIdOrderByCreatedAtDesc(userId), userId, lang);
    }

    /* ---------- writing ---------- */

    @Transactional
    public void setFavorite(UUID userId, UUID foodId, boolean on) {
        visible(userId, foodId);
        var key = new FoodFavorite.Key(userId, foodId);
        if (on && !favorites.existsById(key)) favorites.save(new FoodFavorite(userId, foodId, Instant.now(clock)));
        if (!on) favorites.deleteById(key);
    }

    @Transactional
    public FoodDto create(UUID userId, NewFood req, String lang) {
        Food f = new Food(UUID.randomUUID(), Food.Source.CUSTOM, null, userId, Instant.now(clock));
        String name = req.name().trim();
        f.describe(name, name, blankToNull(req.brand()), req.barcode());
        f.setNutrition(req.kcal(), orZero(req.proteinG()), orZero(req.fatG()), orZero(req.carbsG()),
                req.fiberG(), req.sugarG());
        List<Serving> servings = new ArrayList<>();
        if (req.serving() != null) {
            String label = req.serving().label().trim();
            servings.add(new Serving(label, label, req.serving().grams().doubleValue()));
        }
        f.setServingsJson(write(servings));
        foods.save(f);
        return get(userId, f.getId(), lang);
    }

    /** Nutrition per 100 g is computed from the ingredients; "1 portion" = total weight / portions. */
    @Transactional
    public FoodDto createRecipe(UUID userId, NewRecipe req, String lang) {
        double grams = 0, kcal = 0, p = 0, fat = 0, c = 0, fiber = 0, sugar = 0;
        boolean fiberKnown = true, sugarKnown = true;
        UUID recipeId = UUID.randomUUID();
        List<RecipeIngredient> rows = new ArrayList<>();
        int pos = 0;
        for (var in : req.ingredients()) {
            Food i = visible(userId, in.foodId());
            double g = in.grams().doubleValue();
            double k = g / 100;
            grams += g;
            kcal += i.getKcal().doubleValue() * k;
            p += i.getProteinG().doubleValue() * k;
            fat += i.getFatG().doubleValue() * k;
            c += i.getCarbsG().doubleValue() * k;
            if (i.getFiberG() == null) fiberKnown = false; else fiber += i.getFiberG().doubleValue() * k;
            if (i.getSugarG() == null) sugarKnown = false; else sugar += i.getSugarG().doubleValue() * k;
            rows.add(new RecipeIngredient(recipeId, pos++, i.getId(), in.grams()));
        }
        double per = 100 / grams;
        Food r = new Food(recipeId, Food.Source.RECIPE, null, userId, Instant.now(clock));
        String name = req.name().trim();
        r.describe(name, name, null, null);
        r.setNutrition(round(kcal * per, 1), round(p * per, 2), round(fat * per, 2), round(c * per, 2),
                fiberKnown ? round(fiber * per, 2) : null, sugarKnown ? round(sugar * per, 2) : null);
        double portion = Math.round(grams / req.portions() * 10) / 10.0;
        r.setServingsJson(write(List.of(
                new Serving("1 порция", "1 serving", portion),
                new Serving("Всё блюдо", "Whole recipe", Math.round(grams * 10) / 10.0))));
        foods.saveAndFlush(r);
        ingredients.saveAll(rows);
        return get(userId, recipeId, lang);
    }

    @Transactional
    public void delete(UUID userId, UUID foodId) {
        Food f = foods.findById(foodId).filter(x -> userId.equals(x.getOwnerId()))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Food not found"));
        if (ingredients.existsByFoodId(foodId)) {
            throw new ApiException(HttpStatus.CONFLICT, "FOOD_IN_RECIPE", "This food is used in one of your recipes.");
        }
        foods.delete(f);
    }

    /** Loads a food the user may see, or 404. */
    public Food visible(UUID userId, UUID foodId) {
        return foods.findById(foodId).filter(f -> f.visibleTo(userId))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Food not found"));
    }

    public List<Serving> servings(Food f) {
        try {
            return json.readValue(f.getServingsJson(), new TypeReference<List<Serving>>() {});
        } catch (Exception e) {
            return List.of();
        }
    }

    /* ---------- helpers ---------- */

    private List<FoodDto> toDtos(List<Food> list, UUID userId, String lang) {
        Set<UUID> fav = new HashSet<>();
        if (!list.isEmpty()) {
            favorites.findByUserIdAndFoodIdIn(userId, list.stream().map(Food::getId).toList())
                    .forEach(x -> fav.add(x.getFoodId()));
        }
        return list.stream().map(f -> new FoodDto(f.getId(), f.getSource(), f.getBarcode(), f.name(lang), f.getBrand(),
                new Per100(f.getKcal(), f.getProteinG(), f.getFatG(), f.getCarbsG(), f.getFiberG(), f.getSugarG()),
                servings(f).stream().map(s -> new ServingDto(s.label(lang), s.g())).toList(),
                fav.contains(f.getId()), userId.equals(f.getOwnerId()), null)).toList();
    }

    private static FoodDto fromOff(OpenFoodFactsClient.Product p, String lang) {
        return new FoodDto(null, Food.Source.OFF, p.barcode(), "en".equals(lang) ? p.nameEn() : p.nameRu(), p.brand(),
                new Per100(round(p.kcal(), 1), round(p.protein(), 2), round(p.fat(), 2), round(p.carbs(), 2),
                        p.fiber() == null ? null : round(p.fiber(), 2), p.sugar() == null ? null : round(p.sugar(), 2)),
                p.servings().stream().map(s -> new ServingDto(s.label(lang), s.g())).toList(), false, false, null);
    }

    /** 0 = own food starting with the query, then catalog foods starting with it, then word starts, then the rest. */
    private static int rank(Food f, String q, UUID userId) {
        String ru = normalize(f.getNameRu());
        String en = f.getNameEn().toLowerCase(Locale.ROOT);
        int score;
        if (ru.startsWith(q) || en.startsWith(q)) score = 0;
        else if (ru.contains(" " + q) || en.contains(" " + q)) score = 1;
        else score = 2;
        if (f.getSource() == Food.Source.OFF) score += 1;
        if (userId.equals(f.getOwnerId())) score -= 1;
        return score;
    }

    static String normalize(String s) {
        return s == null ? "" : s.trim().toLowerCase(Locale.ROOT).replace('ё', 'е').replaceAll("[%_]", "");
    }

    private String write(List<Serving> servings) {
        try {
            return json.writeValueAsString(servings);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private static String cut(String s) {
        return s.length() > 160 ? s.substring(0, 160) : s;
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    private static BigDecimal orZero(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }

    static BigDecimal round(double v, int scale) {
        return BigDecimal.valueOf(v).setScale(scale, RoundingMode.HALF_UP);
    }
}
