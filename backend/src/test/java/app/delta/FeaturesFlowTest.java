package app.delta;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Profile, nutrition diary, photo analysis, coach and dashboard. AI runs in demo mode (no key in tests). */
@SpringBootTest
@AutoConfigureMockMvc
class FeaturesFlowTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    private String token(String body) throws Exception {
        String onboarding = """
                {"adult": true,
                 "screening": {"heartCondition": false, "chestPain": false, "dizziness": false,
                               "injury": false, "pregnant": false},
                 "consent": true, "goal": "BUILD_MUSCLE", "daysPerWeek": 4, "minutesPerSession": 60,
                 "account": {"name": "Ann", "email": "%s@example.com", "password": "secret-pass-1"}%s}
                """.formatted(java.util.UUID.randomUUID(), body == null ? "" : ", \"body\": " + body);
        String res = mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(onboarding))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return "Bearer " + json.readTree(res).get("token").asText();
    }

    @Test
    void bodyFromOnboardingGivesTargets() throws Exception {
        String auth = token("""
                {"sex": "MALE", "birthYear": 2000, "heightCm": 180, "weightKg": 80}""");
        mvc.perform(get("/api/me").header("Authorization", auth))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.heightCm").value(180))
                .andExpect(jsonPath("$.targets.kcal").isNumber())
                .andExpect(jsonPath("$.targets.proteinG").value(144))
                .andExpect(jsonPath("$.targets.custom").value(false));
    }

    @Test
    void noBodyMeansNoTargetsUntilProfileIsFilled() throws Exception {
        String auth = token(null);
        mvc.perform(get("/api/me").header("Authorization", auth))
                .andExpect(jsonPath("$.targets").doesNotExist());

        mvc.perform(put("/api/profile").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"goal": "GENERAL_FITNESS", "daysPerWeek": 3, "minutesPerSession": 45,
                                 "sex": "FEMALE", "birthYear": 1995, "heightCm": 165, "weightKg": 60,
                                 "calorieTarget": 1900}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.goal").value("GENERAL_FITNESS"))
                .andExpect(jsonPath("$.targets.kcal").value(1900))
                .andExpect(jsonPath("$.targets.custom").value(true));
    }

    @Test
    void foodDiaryAddsTotalsAndDeletes() throws Exception {
        String auth = token(null);
        String created = mvc.perform(post("/api/nutrition/entries").header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"meal": "LUNCH", "source": "PHOTO", "items": [
                                  {"name": "Rice", "grams": 200, "kcal": 260, "proteinG": 5, "fatG": 0.6, "carbsG": 57},
                                  {"name": "Chicken", "grams": 150, "kcal": 248, "proteinG": 46.5, "fatG": 5.4, "carbsG": 0}
                                ]}"""))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        JsonNode entries = json.readTree(created);
        assertThat(entries).hasSize(2);

        mvc.perform(get("/api/nutrition/day").header("Authorization", auth))
                .andExpect(jsonPath("$.totals.kcal").value(508))
                .andExpect(jsonPath("$.totals.proteinG").value(52))
                .andExpect(jsonPath("$.entries.length()").value(2))
                .andExpect(jsonPath("$.entries[0].source").value("PHOTO"));

        mvc.perform(delete("/api/nutrition/entries/" + entries.get(0).get("id").asText())
                        .header("Authorization", auth))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/nutrition/day").header("Authorization", auth))
                .andExpect(jsonPath("$.totals.kcal").value(248));
    }

    @Test
    void otherUsersCannotDeleteMyFood() throws Exception {
        String mine = token(null);
        String other = token(null);
        String created = mvc.perform(post("/api/nutrition/entries").header("Authorization", mine)
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"meal": "SNACK", "items": [{"name": "Apple", "kcal": 80}]}"""))
                .andReturn().getResponse().getContentAsString();
        String id = json.readTree(created).get(0).get("id").asText();
        mvc.perform(delete("/api/nutrition/entries/" + id).header("Authorization", other))
                .andExpect(status().isNotFound());
    }

    @Test
    void photoAnalysisReturnsItemsWithoutSaving() throws Exception {
        String auth = token(null);
        String image = Base64.getEncoder().encodeToString(new byte[600]);
        mvc.perform(post("/api/nutrition/analyze").header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"imageBase64\": \"data:image/jpeg;base64," + image + "\", \"lang\": \"ru\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.demo").value(true))
                .andExpect(jsonPath("$.food").value(true))
                .andExpect(jsonPath("$.items.length()").value(3))
                .andExpect(jsonPath("$.totals.kcal").value(517))
                .andExpect(jsonPath("$.dish").value(containsString("Курица")));

        mvc.perform(get("/api/nutrition/day").header("Authorization", auth))
                .andExpect(jsonPath("$.entries.length()").value(0));
    }

    @Test
    void coachKeepsTheConversation() throws Exception {
        String auth = token(null);
        mvc.perform(post("/api/coach/messages").header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"text\": \"How do I start?\", \"lang\": \"en\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("coach"))
                .andExpect(jsonPath("$.content").value(containsString("Demo mode")));

        mvc.perform(get("/api/coach/messages").header("Authorization", auth))
                .andExpect(jsonPath("$.demo").value(true))
                .andExpect(jsonPath("$.messages.length()").value(2))
                .andExpect(jsonPath("$.messages[0].role").value("user"))
                .andExpect(jsonPath("$.messages[0].content").value("How do I start?"));

        mvc.perform(delete("/api/coach/messages").header("Authorization", auth)).andExpect(status().isNoContent());
        mvc.perform(get("/api/coach/messages").header("Authorization", auth))
                .andExpect(jsonPath("$.messages.length()").value(0));
    }

    @Test
    void dashboardCombinesWorkoutsAndFood() throws Exception {
        String auth = token(null);
        for (int i = 0; i < 3; i++) {
            mvc.perform(post("/api/log/sets").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                    .content("{\"exercise\": \"Squat\", \"weightKg\": 60, \"reps\": 8}")).andExpect(status().isCreated());
        }
        mvc.perform(post("/api/nutrition/entries").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                .content("{\"meal\": \"BREAKFAST\", \"items\": [{\"name\": \"Oats\", \"kcal\": 350, \"proteinG\": 12}]}"));

        mvc.perform(get("/api/dashboard").header("Authorization", auth))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.kcalToday").value(350))
                .andExpect(jsonPath("$.proteinToday").value(12))
                .andExpect(jsonPath("$.setsToday").value(3))
                .andExpect(jsonPath("$.workoutsThisWeek").value(1))
                .andExpect(jsonPath("$.plannedPerWeek").value(4))
                .andExpect(jsonPath("$.streakDays").value(1))
                .andExpect(jsonPath("$.days.length()").value(7))
                .andExpect(jsonPath("$.days[6].volumeKg").value(1440))
                .andExpect(jsonPath("$.lifts[0].exercise").value("Squat"))
                .andExpect(jsonPath("$.lifts[0].e1rmByWeek.length()").value(6))
                .andExpect(jsonPath("$.lifts[0].e1rmByWeek[5]").value(76.0));
    }
}
