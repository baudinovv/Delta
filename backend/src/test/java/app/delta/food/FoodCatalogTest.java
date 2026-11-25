package app.delta.food;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Food catalog: search, barcode (Open Food Facts mocked), favorites, recent, custom foods, recipes, water, report. */
@SpringBootTest
@AutoConfigureMockMvc
class FoodCatalogTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @MockBean OpenFoodFactsClient off;

    private static final String TODAY = LocalDate.now(ZoneId.of("Asia/Almaty")).toString();

    private String user() throws Exception {
        String res = mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content("""
                        {"adult": true,
                         "screening": {"heartCondition": false, "chestPain": false, "dizziness": false,
                                       "injury": false, "pregnant": false},
                         "consent": true, "goal": "GENERAL_FITNESS", "daysPerWeek": 3, "minutesPerSession": 45,
                         "body": {"sex": "MALE", "birthYear": 2000, "heightCm": 180, "weightKg": 80},
                         "account": {"name": "T", "email": "%s@example.com", "password": "password-123"}}
                        """.formatted(UUID.randomUUID())))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return "Bearer " + json.readTree(res).get("token").asText();
    }

    private JsonNode body(ResultActions r) throws Exception {
        return json.readTree(r.andReturn().getResponse().getContentAsString());
    }

    private String buckwheatId(String auth) throws Exception {
        return body(mvc.perform(get("/api/foods/search").param("q", "гречка").header("Authorization", auth)))
                .get("local").get(0).get("id").asText();
    }

    @Test
    void searchFindsBuiltInFoodsInRussianAndEnglish() throws Exception {
        String auth = user();
        mvc.perform(get("/api/foods/search").param("q", "Гречк").header("Authorization", auth))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.local[0].name").value("Гречка отварная"))
                .andExpect(jsonPath("$.local[0].per100.kcal").value(110.0))
                .andExpect(jsonPath("$.local[0].servings[0].label").value("1 порция"))
                .andExpect(jsonPath("$.online").doesNotExist());
        // ё in the catalog is found by a query typed with е
        mvc.perform(get("/api/foods/search").param("q", "темный").header("Authorization", auth))
                .andExpect(jsonPath("$.local[*].name", hasItem("Шоколад тёмный 70%")));
        mvc.perform(get("/api/foods/search").param("q", "buckwheat").param("lang", "en").header("Authorization", auth))
                .andExpect(jsonPath("$.local[0].name").value("Buckwheat, boiled"))
                .andExpect(jsonPath("$.local[0].servings[0].label").value("1 serving"));
    }

    @Test
    void onlineSearchAddsOpenFoodFactsResults() throws Exception {
        when(off.search(anyString())).thenReturn(List.of(new OpenFoodFactsClient.Product("4870001234567",
                "Гречка ядрица Мистраль", "Buckwheat", "Мистраль", 313, 12.6, 3.3, 62.1, 11.0, 1.0, List.of())));
        mvc.perform(get("/api/foods/search").param("q", "гречка").param("online", "true").header("Authorization", user()))
                .andExpect(jsonPath("$.online[0].barcode").value("4870001234567"))
                .andExpect(jsonPath("$.online[0].id").doesNotExist())
                .andExpect(jsonPath("$.online[0].brand").value("Мистраль"));
    }

    @Test
    void barcodeIsImportedFromOpenFoodFactsOnceThenServedFromCatalog() throws Exception {
        String code = "48" + (System.nanoTime() % 100_000_000_000L);
        when(off.byBarcode(code)).thenReturn(Optional.of(new OpenFoodFactsClient.Product(code, "Кефир 2,5%", "Kefir",
                "Фудмастер", 53, 3, 2.5, 4, null, 4.0,
                List.of(new Serving("Упаковка (900 мл)", "Package (900 ml)", 900)))));
        String auth = user();
        String id = body(mvc.perform(get("/api/foods/barcode/" + code).header("Authorization", auth))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.source").value("OFF"))
                .andExpect(jsonPath("$.name").value("Кефир 2,5%"))
                .andExpect(jsonPath("$.servings[0].grams").value(900.0))).get("id").asText();
        mvc.perform(get("/api/foods/barcode/" + code).header("Authorization", user()))
                .andExpect(jsonPath("$.id").value(id));
        verify(off, times(1)).byBarcode(code);

        when(off.byBarcode("4600000000000")).thenReturn(Optional.empty());
        mvc.perform(get("/api/foods/barcode/4600000000000").header("Authorization", auth))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("BARCODE_NOT_FOUND"));
    }

    @Test
    void loggingACatalogFoodComputesNutritionAndShowsUpInRecent() throws Exception {
        String auth = user();
        String id = buckwheatId(auth);
        mvc.perform(post("/api/nutrition/entries").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"meal": "LUNCH", "lang": "ru", "items": [
                                  {"foodId": "%s", "grams": 200, "servingLabel": "1 порция", "servingsCount": 1}]}
                                """.formatted(id)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$[0].kcal").value(220))
                .andExpect(jsonPath("$[0].proteinG").value(8.4))
                .andExpect(jsonPath("$[0].fiberG").value(5.4))
                .andExpect(jsonPath("$[0].source").value("CATALOG"))
                .andExpect(jsonPath("$[0].name").value("Гречка отварная"));

        mvc.perform(get("/api/foods/recent").header("Authorization", auth))
                .andExpect(jsonPath("$[0].food.id").value(id))
                .andExpect(jsonPath("$[0].servingLabel").value("1 порция"))
                .andExpect(jsonPath("$[0].grams").value(200));
        mvc.perform(get("/api/nutrition/day").header("Authorization", auth))
                .andExpect(jsonPath("$.totals.fiberG").value(5));
    }

    @Test
    void favoritesToggle() throws Exception {
        String auth = user();
        String id = buckwheatId(auth);
        mvc.perform(put("/api/foods/" + id + "/favorite").header("Authorization", auth)).andExpect(status().isNoContent());
        mvc.perform(get("/api/foods/favorites").header("Authorization", auth))
                .andExpect(jsonPath("$[0].id").value(id))
                .andExpect(jsonPath("$[0].favorite").value(true));
        mvc.perform(delete("/api/foods/" + id + "/favorite").header("Authorization", auth)).andExpect(status().isNoContent());
        mvc.perform(get("/api/foods/favorites").header("Authorization", auth)).andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void customFoodsArePrivateAndFoundByTheirBarcode() throws Exception {
        String mine = user();
        String id = body(mvc.perform(post("/api/foods").header("Authorization", mine).contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name": "Самса бабушкина", "barcode": "2000000000017", "kcal": 300, "proteinG": 10,
                                 "fatG": 15, "carbsG": 30, "serving": {"label": "1 шт", "grams": 120}}"""))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.own").value(true))
                .andExpect(jsonPath("$.servings[0].grams").value(120.0))).get("id").asText();

        mvc.perform(get("/api/foods/search").param("q", "бабушкина").header("Authorization", mine))
                .andExpect(jsonPath("$.local[0].id").value(id));
        mvc.perform(get("/api/foods/barcode/2000000000017").header("Authorization", mine))
                .andExpect(jsonPath("$.id").value(id));

        String other = user();
        mvc.perform(get("/api/foods/" + id).header("Authorization", other)).andExpect(status().isNotFound());
        mvc.perform(get("/api/foods/search").param("q", "бабушкина").header("Authorization", other))
                .andExpect(jsonPath("$.local.length()").value(0));
    }

    @Test
    void recipeNutritionComesFromIngredients() throws Exception {
        String auth = user();
        String buckwheat = buckwheatId(auth);
        String butter = body(mvc.perform(get("/api/foods/search").param("q", "масло сливочное").header("Authorization", auth)))
                .get("local").get(0).get("id").asText();
        JsonNode recipe = body(mvc.perform(post("/api/foods/recipes").header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"name": "Гречка с маслом", "portions": 2, "ingredients": [
                                  {"foodId": "%s", "grams": 400}, {"foodId": "%s", "grams": 20}]}
                                """.formatted(buckwheat, butter)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.source").value("RECIPE"))
                .andExpect(jsonPath("$.ingredients.length()").value(2))
                .andExpect(jsonPath("$.servings[0].grams").value(210.0)));
        // (400 * 110 + 20 * 748) / 420 g * 100 = 140.4 kcal per 100 g
        assertThat(recipe.get("per100").get("kcal").asDouble()).isEqualTo(140.4);

        mvc.perform(delete("/api/foods/" + butter).header("Authorization", auth)).andExpect(status().isNotFound());
        String own = body(mvc.perform(post("/api/foods").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\": \"Соус\", \"kcal\": 100}"))).get("id").asText();
        mvc.perform(post("/api/foods/recipes").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\": \"С соусом\", \"portions\": 1, \"ingredients\": [{\"foodId\": \"%s\", \"grams\": 50}]}"
                        .formatted(own))).andExpect(status().isCreated());
        mvc.perform(delete("/api/foods/" + own).header("Authorization", auth))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("FOOD_IN_RECIPE"));
    }

    @Test
    void copyYesterdaysMeal() throws Exception {
        String auth = user();
        String yesterday = LocalDate.parse(TODAY).minusDays(1).toString();
        mvc.perform(post("/api/nutrition/entries").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                .content("{\"date\": \"%s\", \"meal\": \"BREAKFAST\", \"items\": [{\"name\": \"Каша\", \"kcal\": 300}]}"
                        .formatted(yesterday))).andExpect(status().isCreated());
        mvc.perform(post("/api/nutrition/copy").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fromDate\": \"%s\", \"fromMeal\": \"BREAKFAST\", \"toDate\": \"%s\", \"toMeal\": \"BREAKFAST\"}"
                                .formatted(yesterday, TODAY)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$[0].name").value("Каша"));
        mvc.perform(get("/api/nutrition/day").header("Authorization", auth))
                .andExpect(jsonPath("$.totals.kcal").value(300));
        mvc.perform(post("/api/nutrition/copy").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fromDate\": \"%s\", \"fromMeal\": \"DINNER\", \"toDate\": \"%s\", \"toMeal\": \"DINNER\"}"
                                .formatted(yesterday, TODAY)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("NOTHING_TO_COPY"));
    }

    @Test
    void waterAddsUpAndNeverGoesNegative() throws Exception {
        String auth = user();
        mvc.perform(post("/api/nutrition/water").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"deltaMl\": 250}"))
                .andExpect(jsonPath("$.ml").value(250))
                .andExpect(jsonPath("$.targetMl").value(2650));
        mvc.perform(post("/api/nutrition/water").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                .content("{\"deltaMl\": -1000}")).andExpect(jsonPath("$.ml").value(0));
        mvc.perform(post("/api/nutrition/water").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                .content("{\"deltaMl\": 500}"));
        mvc.perform(get("/api/nutrition/day").header("Authorization", auth))
                .andExpect(jsonPath("$.waterMl").value(500))
                .andExpect(jsonPath("$.waterTargetMl").value(2650));
    }

    @Test
    void reportAveragesLoggedDays() throws Exception {
        String auth = user();
        String yesterday = LocalDate.parse(TODAY).minusDays(1).toString();
        for (String[] d : new String[][]{{TODAY, "2000"}, {yesterday, "3000"}}) {
            mvc.perform(post("/api/nutrition/entries").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                    .content("""
                            {"date": "%s", "meal": "LUNCH",
                             "items": [{"name": "Плов", "kcal": %s, "proteinG": 100, "fatG": 50, "carbsG": 200}]}
                            """.formatted(d[0], d[1])));
        }
        mvc.perform(get("/api/nutrition/report").param("days", "7").header("Authorization", auth))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.days").value(7))
                .andExpect(jsonPath("$.byDay.length()").value(7))
                .andExpect(jsonPath("$.loggedDays").value(2))
                .andExpect(jsonPath("$.avgKcal").value(2500))
                .andExpect(jsonPath("$.avgProteinG").value(100))
                .andExpect(jsonPath("$.proteinPct").value(24))
                .andExpect(jsonPath("$.fatPct").value(27))
                .andExpect(jsonPath("$.carbsPct").value(48))
                .andExpect(jsonPath("$.topFoods[0].name").value("Плов"))
                .andExpect(jsonPath("$.topFoods[0].times").value(2));
    }
}
