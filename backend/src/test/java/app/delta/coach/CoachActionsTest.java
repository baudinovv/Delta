package app.delta.coach;

import app.delta.ai.AiClient;
import app.delta.common.ApiException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** The AI coach acting through tools. The model is replaced by a script that makes the calls a model would. */
@SpringBootTest
@AutoConfigureMockMvc
class CoachActionsTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired CoachTools tools;
    @MockBean AiClient ai;

    /** Tool results the scripted "model" received, to assert what the server told it. */
    private final List<Map<String, Object>> results = new ArrayList<>();

    private String user() throws Exception {
        String res = mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content("""
                        {"adult": true,
                         "screening": {"heartCondition": false, "chestPain": false, "dizziness": false,
                                       "injury": false, "pregnant": false},
                         "consent": true, "goal": "BUILD_MUSCLE", "daysPerWeek": 3, "minutesPerSession": 60,
                         "body": {"sex": "MALE", "birthYear": 2000, "heightCm": 180, "weightKg": 80},
                         "account": {"name": "C", "email": "%s@example.com", "password": "password-123"}}
                        """.formatted(UUID.randomUUID())))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return "Bearer " + json.readTree(res).get("token").asText();
    }

    /** The scripted model calls the given tools in order, then answers with `reply`. */
    private void script(String reply, String... calls) {
        when(ai.live()).thenReturn(true);
        when(ai.chatWithTools(anyString(), anyList(), anyList(), any())).thenAnswer(inv -> {
            AiClient.ToolExecutor exec = inv.getArgument(3);
            for (String c : calls) {
                JsonNode call = json.readTree(c);
                results.add(exec.call(call.get("name").asText(), call.get("args")));
            }
            return reply;
        });
    }

    private ResultActions ask(String auth, String text) throws Exception {
        return mvc.perform(post("/api/coach/messages").header("Authorization", auth)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("text", text, "lang", "ru"))));
    }

    @Test
    void logsSetsAndTheyCanBeUndone() throws Exception {
        String auth = user();
        script("Записал присед: 3 подхода.", """
                {"name": "log_sets", "args": {"exercise": "squat",
                  "sets": [{"weightKg": 60, "reps": 5}, {"weightKg": 60, "reps": 5}, {"weightKg": 62.5, "reps": 5}]}}""");
        String body = ask(auth, "запиши присед 60 на 5 два подхода и 62.5 на 5")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").value("Записал присед: 3 подхода."))
                .andExpect(jsonPath("$.actions[0].type").value("SET"))
                .andExpect(jsonPath("$.actions[0].label").value("Присед: 60×5, 60×5, 62.5×5 кг"))
                .andExpect(jsonPath("$.actions[0].ids.length()").value(3))
                .andReturn().getResponse().getContentAsString();
        mvc.perform(get("/api/log/today").header("Authorization", auth))
                .andExpect(jsonPath("$.todaySets.length()").value(3));

        // undo = the app deletes the ids from the action
        for (JsonNode id : json.readTree(body).at("/actions/0/ids")) {
            mvc.perform(delete("/api/log/sets/" + id.asText()).header("Authorization", auth)).andExpect(status().isNoContent());
        }
        mvc.perform(get("/api/log/today").header("Authorization", auth))
                .andExpect(jsonPath("$.todaySets.length()").value(0));
    }

    @Test
    void logsFoodFromTheCatalogOrTheModelsEstimate() throws Exception {
        String auth = user();
        script("Записал обед.", """
                {"name": "log_food", "args": {"meal": "LUNCH", "items": [
                  {"name": "Гречка отварная", "grams": 200, "kcal": 999, "proteinG": 1, "fatG": 1, "carbsG": 1},
                  {"name": "Самса домашняя", "grams": 120, "kcal": 330, "proteinG": 11, "fatG": 18, "carbsG": 31}]}}""");
        ask(auth, "на обед гречка 200 грамм и самса")
                .andExpect(jsonPath("$.actions[0].type").value("FOOD"))
                .andExpect(jsonPath("$.actions[0].ids.length()").value(2))
                .andExpect(jsonPath("$.actions[0].label", containsString("550 ккал")));
        // the catalog's 110 kcal/100 g wins over the model's 999 for buckwheat; samsa uses the estimate
        mvc.perform(get("/api/nutrition/day").header("Authorization", auth))
                .andExpect(jsonPath("$.totals.kcal").value(550))
                .andExpect(jsonPath("$.entries[0].source").value("CATALOG"))
                .andExpect(jsonPath("$.entries[1].name").value("Самса домашняя"));
        assertThat(results.get(0).toString()).contains("fromDatabase=true").contains("fromDatabase=false");
    }

    @Test
    void savesAPlanThatTheAppCanShow() throws Exception {
        String auth = user();
        script("Готов план на 3 дня.", """
                {"name": "save_workout_plan", "args": {"title": "Фулбоди 3×", "days": [
                  {"weekday": 5, "focus": "Ноги", "exercises": [{"name": "Squat", "sets": 3, "reps": "6-8", "weightKg": 65}]},
                  {"weekday": 1, "focus": "Всё тело", "exercises": [
                    {"name": "Squat", "sets": 3, "reps": "8", "weightKg": 60},
                    {"name": "Bench Press", "sets": 3, "reps": "8-10", "note": "лопатки сведены"}]},
                  {"weekday": 3, "focus": "Верх", "exercises": [{"name": "Seated Row", "sets": 3, "reps": "10"}]}]}}""");
        ask(auth, "составь план на неделю")
                .andExpect(jsonPath("$.actions[0].type").value("PLAN"))
                .andExpect(jsonPath("$.actions[0].label").value("План: Фулбоди 3× · 3 дн./нед."));
        mvc.perform(get("/api/plan").header("Authorization", auth))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Фулбоди 3×"))
                .andExpect(jsonPath("$.days[0].weekday").value(1))
                .andExpect(jsonPath("$.days[0].exercises[1].note").value("лопатки сведены"))
                .andExpect(jsonPath("$.days[2].weekday").value(5));
        mvc.perform(delete("/api/plan").header("Authorization", auth)).andExpect(status().isNoContent());
        mvc.perform(get("/api/plan").header("Authorization", auth)).andExpect(status().isNoContent());
    }

    @Test
    void badToolArgumentsAreRejectedNotStored() throws Exception {
        String auth = user();
        UUID userId = UUID.fromString(json.readTree(mvc.perform(get("/api/me").header("Authorization", auth))
                .andReturn().getResponse().getContentAsString()).get("userId").asText());
        var run = tools.run(userId, "ru");
        assertThatThrownBy(() -> run.call("save_workout_plan", json.readTree("""
                {"title": "x", "days": [{"weekday": 9, "focus": "?", "exercises": [{"name": "Squat", "sets": 3, "reps": "5"}]}]}""")))
                .isInstanceOf(ApiException.class).hasMessageContaining("weekday");
        assertThatThrownBy(() -> run.call("log_sets", json.readTree("""
                {"exercise": "Squat", "sets": [{"weightKg": 60, "reps": 0}]}"""))).isInstanceOf(ApiException.class);
        assertThat(run.actions()).isEmpty();
    }

    @Test
    void voiceIsTranscribedThenActedOn() throws Exception {
        String auth = user();
        when(ai.transcribe(any(), anyString())).thenReturn("запиши пол литра воды");
        script("Добавил 500 мл воды.", """
                {"name": "add_water", "args": {"ml": 500}}""");
        mvc.perform(post("/api/coach/messages/voice").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"audioBase64\": \"AAAA\", \"mimeType\": \"audio/webm;codecs=opus\", \"lang\": \"ru\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.transcript").value("запиши пол литра воды"))
                .andExpect(jsonPath("$.reply.actions[0].type").value("WATER"))
                .andExpect(jsonPath("$.reply.actions[0].ml").value(500));
        mvc.perform(get("/api/nutrition/day").header("Authorization", auth)).andExpect(jsonPath("$.waterMl").value(500));
        // the conversation keeps the transcript and the actions
        mvc.perform(get("/api/coach/messages").header("Authorization", auth))
                .andExpect(jsonPath("$.messages[0].content").value("запиши пол литра воды"))
                .andExpect(jsonPath("$.messages[1].actions[0].label").value("Вода +500 мл"));

        when(ai.transcribe(any(), anyString())).thenReturn("  ");
        mvc.perform(post("/api/coach/messages/voice").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"audioBase64\": \"AAAA\", \"mimeType\": \"audio/wav\", \"lang\": \"ru\"}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("NOTHING_HEARD"));
    }

    @Test
    void actionsSurviveTheModelFailingAfterwards() throws Exception {
        String auth = user();
        when(ai.chatWithTools(anyString(), anyList(), anyList(), any())).thenAnswer(inv -> {
            AiClient.ToolExecutor exec = inv.getArgument(3);
            exec.call("update_weight", json.readTree("{\"weightKg\": 79.4}"));
            throw new ApiException(HttpStatus.BAD_GATEWAY, "AI_UNAVAILABLE", "down");
        });
        ask(auth, "мой вес 79.4")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").value("Готово."))
                .andExpect(jsonPath("$.actions[0].label").value("Вес: 80 → 79.4 кг"));
        mvc.perform(get("/api/me").header("Authorization", auth)).andExpect(jsonPath("$.weightKg").value(79.4));
    }
}
