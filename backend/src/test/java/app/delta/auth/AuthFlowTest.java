package app.delta.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class AuthFlowTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;

    private ResultActions register(String email, String password) throws Exception {
        return mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content("""
                {"adult": true,
                 "screening": {"heartCondition": false, "chestPain": false, "dizziness": false,
                               "injury": false, "pregnant": false},
                 "consent": true, "goal": "GENERAL_FITNESS", "daysPerWeek": 3, "minutesPerSession": 45,
                 "account": {"name": " Alex ", "email": "%s", "password": "%s"}}
                """.formatted(email, password)));
    }

    private ResultActions login(String email, String password) throws Exception {
        return mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\": \"%s\", \"password\": \"%s\"}".formatted(email, password)));
    }

    private String token(ResultActions r) throws Exception {
        return "Bearer " + json.readTree(r.andReturn().getResponse().getContentAsString()).get("token").asText();
    }

    private static String email() {
        return UUID.randomUUID() + "@example.com";
    }

    @Test
    void registerThenLoginOnAnotherDevice() throws Exception {
        String email = email();
        String phone = token(register(email, "password-123").andExpect(status().isCreated()));
        String laptop = token(login(email.toUpperCase(), "password-123").andExpect(status().isOk()));
        assertThat(laptop).isNotEqualTo(phone);

        mvc.perform(get("/api/me").header("Authorization", phone))
                .andExpect(jsonPath("$.name").value("Alex"))
                .andExpect(jsonPath("$.email").value(email));
        mvc.perform(get("/api/me").header("Authorization", laptop)).andExpect(status().isOk());
    }

    @Test
    void emailIsUnique() throws Exception {
        String email = email();
        register(email, "password-123").andExpect(status().isCreated());
        register(email.toUpperCase(), "password-456")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EMAIL_TAKEN"));
    }

    @Test
    void weakPasswordAndBadEmailAreRejected() throws Exception {
        register(email(), "short").andExpect(status().isBadRequest());
        register("not-an-email", "password-123").andExpect(status().isBadRequest());
    }

    @Test
    void wrongPasswordIsRejectedWithoutSayingWhichPartIsWrong() throws Exception {
        String email = email();
        register(email, "password-123");
        login(email, "nope-nope-nope").andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
        login(email(), "password-123").andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
    }

    @Test
    void tooManyFailedLoginsAreThrottled() throws Exception {
        String email = email();
        register(email, "password-123");
        for (int i = 0; i < LoginLimiter.MAX_FAILURES; i++) login(email, "wrong-password");
        login(email, "password-123").andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("TOO_MANY_ATTEMPTS"));
    }

    @Test
    void logoutEndsOnlyThisSession() throws Exception {
        String email = email();
        String a = token(register(email, "password-123"));
        String b = token(login(email, "password-123"));
        mvc.perform(post("/api/auth/logout").header("Authorization", a)).andExpect(status().isNoContent());
        mvc.perform(get("/api/me").header("Authorization", a)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/me").header("Authorization", b)).andExpect(status().isOk());
    }

    @Test
    void changingPasswordSignsOutOtherDevices() throws Exception {
        String email = email();
        String a = token(register(email, "password-123"));
        String b = token(login(email, "password-123"));

        mvc.perform(post("/api/auth/password").header("Authorization", a).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentPassword\": \"wrong-one\", \"newPassword\": \"new-password-1\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/auth/password").header("Authorization", a).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentPassword\": \"password-123\", \"newPassword\": \"new-password-1\"}"))
                .andExpect(status().isNoContent());

        mvc.perform(get("/api/me").header("Authorization", a)).andExpect(status().isOk());
        mvc.perform(get("/api/me").header("Authorization", b)).andExpect(status().isUnauthorized());
        login(email, "password-123").andExpect(status().isUnauthorized());
        login(email, "new-password-1").andExpect(status().isOk());
    }

    @Test
    void deletingAccountRemovesEverything() throws Exception {
        String email = email();
        String auth = token(register(email, "password-123"));
        mvc.perform(post("/api/log/sets").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                .content("{\"exercise\": \"Squat\", \"weightKg\": 40, \"reps\": 10}"));
        String userId = json.readTree(mvc.perform(get("/api/me").header("Authorization", auth))
                .andReturn().getResponse().getContentAsString()).get("userId").asText();

        mvc.perform(post("/api/auth/delete-account").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                .content("{\"password\": \"wrong\"}")).andExpect(status().isForbidden());
        mvc.perform(post("/api/auth/delete-account").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                .content("{\"password\": \"password-123\"}")).andExpect(status().isNoContent());

        mvc.perform(get("/api/me").header("Authorization", auth)).andExpect(status().isUnauthorized());
        login(email, "password-123").andExpect(status().isUnauthorized());
        assertThat(jdbc.queryForObject("select count(*) from set_logs where user_id = ?", Integer.class,
                UUID.fromString(userId))).isZero();
    }
}
