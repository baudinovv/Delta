package app.delta.health;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Apple Health / Health Connect sync: consent, dedupe, summary, Delta sessions for export. */
@SpringBootTest
@AutoConfigureMockMvc
class HealthSyncTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    private static final ZoneId ZONE = ZoneId.of("Asia/Almaty");
    private static final LocalDate TODAY = LocalDate.now(ZONE);

    private String user() throws Exception {
        String res = mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content("""
                        {"adult": true,
                         "screening": {"heartCondition": false, "chestPain": false, "dizziness": false,
                                       "injury": false, "pregnant": false},
                         "consent": true, "goal": "GET_STRONGER", "daysPerWeek": 3, "minutesPerSession": 60,
                         "account": {"name": "H", "email": "%s@example.com", "password": "password-123"}}
                        """.formatted(UUID.randomUUID())))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return "Bearer " + json.readTree(res).get("token").asText();
    }

    private static String sync(int steps, String workoutId) {
        Instant dayStart = TODAY.atStartOfDay(ZONE).toInstant();
        Instant workoutStart = dayStart.plus(8, ChronoUnit.HOURS);
        return """
                {"platform": "IOS", "samples": [
                  {"kind": "STEPS", "externalId": "STEPS:%s", "start": "%s", "end": "%s", "value": %d},
                  {"kind": "ACTIVE_ENERGY", "externalId": "ACTIVE_ENERGY:%s", "start": "%s", "end": "%s", "value": 420},
                  {"kind": "HEART_RATE", "externalId": "HEART_RATE:%s", "start": "%s", "end": "%s", "value": 74},
                  {"kind": "WORKOUT", "externalId": "%s", "start": "%s", "end": "%s",
                   "workoutType": "running", "energyKcal": 310, "avgHr": 148, "sourceName": "Apple Watch"}
                ]}""".formatted(TODAY, dayStart, dayStart.plus(1, ChronoUnit.DAYS), steps,
                TODAY, dayStart, dayStart.plus(1, ChronoUnit.DAYS),
                TODAY, dayStart, dayStart.plus(1, ChronoUnit.DAYS),
                workoutId, workoutStart, workoutStart.plus(32, ChronoUnit.MINUTES));
    }

    @Test
    void nothingIsAcceptedWithoutConsent() throws Exception {
        String auth = user();
        mvc.perform(get("/api/health/status").header("Authorization", auth))
                .andExpect(jsonPath("$.consent").value(false));
        mvc.perform(post("/api/health/sync").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                        .content(sync(5000, "w-1")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("HEALTH_CONSENT_REQUIRED"));
    }

    @Test
    void resyncUpdatesInsteadOfDuplicating() throws Exception {
        String auth = user();
        mvc.perform(put("/api/health/consent").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                .content("{\"consent\": true}")).andExpect(jsonPath("$.consent").value(true));

        mvc.perform(post("/api/health/sync").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                        .content(sync(5000, "hk-uuid-1")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.inserted").value(4))
                .andExpect(jsonPath("$.updated").value(0));
        mvc.perform(post("/api/health/sync").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                        .content(sync(8200, "hk-uuid-1")))
                .andExpect(jsonPath("$.inserted").value(0))
                .andExpect(jsonPath("$.updated").value(4));

        mvc.perform(get("/api/health/status").header("Authorization", auth))
                .andExpect(jsonPath("$.samples").value(4))
                .andExpect(jsonPath("$.syncedAt").exists());
        mvc.perform(get("/api/health/summary").param("days", "7").header("Authorization", auth))
                .andExpect(jsonPath("$.days.length()").value(7))
                .andExpect(jsonPath("$.days[6].steps").value(8200))
                .andExpect(jsonPath("$.days[6].activeKcal").value(420))
                .andExpect(jsonPath("$.days[6].avgHr").value(74))
                .andExpect(jsonPath("$.days[6].workouts").value(1))
                .andExpect(jsonPath("$.days[0].steps").doesNotExist())
                .andExpect(jsonPath("$.stepsToday").value(8200))
                .andExpect(jsonPath("$.avgSteps").value(8200))
                .andExpect(jsonPath("$.workouts[0].type").value("running"))
                .andExpect(jsonPath("$.workouts[0].minutes").value(32))
                .andExpect(jsonPath("$.workouts[0].source").value("Apple Watch"));
        mvc.perform(get("/api/dashboard").header("Authorization", auth))
                .andExpect(jsonPath("$.stepsToday").value(8200))
                .andExpect(jsonPath("$.activeKcalToday").value(420));
    }

    @Test
    void revokingConsentDeletesEverything() throws Exception {
        String auth = user();
        mvc.perform(put("/api/health/consent").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                .content("{\"consent\": true}"));
        mvc.perform(post("/api/health/sync").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                .content(sync(3000, "w-2"))).andExpect(status().isOk());
        mvc.perform(put("/api/health/consent").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"consent\": false}"))
                .andExpect(jsonPath("$.consent").value(false))
                .andExpect(jsonPath("$.samples").value(0));
        mvc.perform(get("/api/dashboard").header("Authorization", auth))
                .andExpect(jsonPath("$.stepsToday").doesNotExist());
    }

    @Test
    void deleteDataKeepsConsent() throws Exception {
        String auth = user();
        mvc.perform(put("/api/health/consent").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                .content("{\"consent\": true}"));
        mvc.perform(post("/api/health/sync").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                .content(sync(3000, "w-3")));
        mvc.perform(delete("/api/health/data").header("Authorization", auth)).andExpect(status().isNoContent());
        mvc.perform(get("/api/health/status").header("Authorization", auth))
                .andExpect(jsonPath("$.consent").value(true))
                .andExpect(jsonPath("$.samples").value(0));
    }

    @Test
    void samplesAreScopedToTheUser() throws Exception {
        String a = user();
        String b = user();
        for (String auth : new String[]{a, b}) {
            mvc.perform(put("/api/health/consent").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                    .content("{\"consent\": true}"));
        }
        // the same HealthKit UUID from two accounts must not collide
        mvc.perform(post("/api/health/sync").header("Authorization", a).contentType(MediaType.APPLICATION_JSON)
                .content(sync(1000, "same-uuid"))).andExpect(jsonPath("$.inserted").value(4));
        mvc.perform(post("/api/health/sync").header("Authorization", b).contentType(MediaType.APPLICATION_JSON)
                .content(sync(2000, "same-uuid"))).andExpect(jsonPath("$.inserted").value(4));
        mvc.perform(get("/api/health/summary").header("Authorization", a))
                .andExpect(jsonPath("$.stepsToday").value(1000));
    }

    @Test
    void loggedSetsBecomeStrengthSessionsForExport() throws Exception {
        String auth = user();
        for (int i = 0; i < 3; i++) {
            mvc.perform(post("/api/log/sets").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                    .content("{\"exercise\": \"Squat\", \"weightKg\": 60, \"reps\": 5}"));
        }
        mvc.perform(post("/api/log/sets").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                .content("{\"exercise\": \"Bench Press\", \"weightKg\": 40, \"reps\": 8}"));
        mvc.perform(get("/api/health/sessions").header("Authorization", auth))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].date").value(TODAY.toString()))
                .andExpect(jsonPath("$[0].sets").value(4))
                .andExpect(jsonPath("$[0].volumeKg").value(1220))
                .andExpect(jsonPath("$[0].exercises[0]").value("Squat"))
                .andExpect(jsonPath("$[0].exercises[1]").value("Bench Press"));
    }
}
