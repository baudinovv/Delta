package app.delta.onboarding;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class ApiFlowTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;

    private static String onboarding(boolean adult, boolean injury, boolean consent) {
        return """
                {"adult": %s,
                 "screening": {"heartCondition": false, "chestPain": false, "dizziness": false,
                               "injury": %s, "pregnant": false},
                 "consent": %s, "goal": "GET_STRONGER", "daysPerWeek": 3, "minutesPerSession": 45,
                 "account": {"name": "Test", "email": "%s@example.com", "password": "secret-pass-1"}}
                """.formatted(adult, injury, consent, java.util.UUID.randomUUID());
    }

    private String onboardAndGetToken() throws Exception {
        String body = mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content(onboarding(true, false, true)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("token").asText();
    }

    @Test
    void under18IsReferredAndNothingStored() throws Exception {
        Integer before = jdbc.queryForObject("select count(*) from users", Integer.class);
        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content(onboarding(false, false, true)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REFERRED"))
                .andExpect(jsonPath("$.reason").value("UNDER_18"))
                .andExpect(jsonPath("$.token").doesNotExist());
        assertThat(jdbc.queryForObject("select count(*) from users", Integer.class)).isEqualTo(before);
    }

    @Test
    void anyHealthFlagIsReferred() throws Exception {
        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content(onboarding(true, true, true)))
                .andExpect(jsonPath("$.status").value("REFERRED"))
                .andExpect(jsonPath("$.reason").value("HEALTH_SCREENING"));
    }

    @Test
    void eligibleUserGetsProfileAndCredentialsAreStoredHashed() throws Exception {
        String token = onboardAndGetToken();
        mvc.perform(get("/api/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Test"))
                .andExpect(jsonPath("$.email").exists())
                .andExpect(jsonPath("$.goal").value("GET_STRONGER"))
                .andExpect(jsonPath("$.daysPerWeek").value(3))
                .andExpect(jsonPath("$.minutesPerSession").value(45))
                .andExpect(jsonPath("$.consentAt").exists())
                .andExpect(jsonPath("$.passwordHash").doesNotExist());

        assertThat(jdbc.queryForList("select password_hash from users where password_hash is not null", String.class))
                .allMatch(h -> h.startsWith("$2"));
        assertThat(jdbc.queryForObject("select count(*) from sessions where token_hash = ?", Integer.class, token))
                .isZero();
        var columns = jdbc.queryForList(
                "select lower(column_name) from information_schema.columns where lower(table_schema) = 'public' and lower(table_name) = 'users'",
                String.class);
        assertThat(columns).noneMatch(c -> c.contains("phone") || c.contains("address"));
    }

    @Test
    void lastSetIsPrefilledAndNewExerciseGetsHint() throws Exception {
        String token = onboardAndGetToken();

        mvc.perform(get("/api/log/today").header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.rows[0].exercise").value("Squat"))
                .andExpect(jsonPath("$.rows[0].weightKg").doesNotExist())
                .andExpect(jsonPath("$.rows[0].hint").value("start light, 10–12 reps"));

        mvc.perform(post("/api/log/sets").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"exercise\": \"squat \", \"weightKg\": 40, \"reps\": 10}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.exercise").value("Squat"));

        String today = mvc.perform(get("/api/log/today").header("Authorization", "Bearer " + token))
                .andReturn().getResponse().getContentAsString();
        JsonNode squat = json.readTree(today).get("rows").get(0);
        assertThat(squat.get("exercise").asText()).isEqualTo("Squat");
        assertThat(squat.get("weightKg").decimalValue()).isEqualByComparingTo("40");
        assertThat(squat.get("reps").asInt()).isEqualTo(10);
        assertThat(squat.has("hint")).isFalse();
    }

    @Test
    void weightWithoutRepsIsRejected() throws Exception {
        String token = onboardAndGetToken();
        mvc.perform(post("/api/log/sets").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"exercise\": \"Squat\", \"weightKg\": 40}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("REPS_REQUIRED"))
                .andExpect(jsonPath("$.message").value("Enter reps to save"));
    }

    @Test
    void firstWeekSummaryIsBaseline() throws Exception {
        String token = onboardAndGetToken();
        mvc.perform(post("/api/log/sets").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"exercise\": \"Squat\", \"weightKg\": 40, \"reps\": 10}"));
        mvc.perform(get("/api/summary/weekly").header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.mode").value("BASELINE"))
                .andExpect(jsonPath("$.message").value("Baseline saved, your first comparison appears next Sunday"))
                .andExpect(jsonPath("$.exercises[0].latest.reps").value(10));
    }

    @Test
    void requestsWithoutTokenAreRejected() throws Exception {
        mvc.perform(get("/api/log/today")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/log/today").header("Authorization", "Bearer nope")).andExpect(status().isUnauthorized());
    }
}
