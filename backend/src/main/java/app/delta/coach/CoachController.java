package app.delta.coach;

import app.delta.coach.CoachService.Message;
import app.delta.coach.CoachService.Thread;
import app.delta.common.AuthInterceptor;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/coach/messages")
public class CoachController {

    private final CoachService coach;

    public CoachController(CoachService coach) {
        this.coach = coach;
    }

    public record Ask(@NotBlank @Size(max = 2000) String text, @Pattern(regexp = "ru|en") String lang) {}

    public record Voice(@NotBlank @Size(max = 6_000_000) String audioBase64,
                        @NotBlank @Pattern(regexp = "audio/[a-z0-9.+-]+(;.*)?") String mimeType,
                        @Pattern(regexp = "ru|en") String lang) {}

    /** Voice message: transcribed by the AI, then answered like a typed one (actions included). */
    @PostMapping("/voice")
    public CoachService.VoiceReply voice(@RequestAttribute(AuthInterceptor.USER_ID) UUID userId,
                                         @Valid @RequestBody Voice body) {
        String mime = body.mimeType().contains(";") ? body.mimeType().substring(0, body.mimeType().indexOf(';')) : body.mimeType();
        return coach.voice(userId, body.audioBase64(), mime, body.lang() == null ? "en" : body.lang());
    }

    @GetMapping
    public Thread thread(@RequestAttribute(AuthInterceptor.USER_ID) UUID userId) {
        return coach.thread(userId);
    }

    @PostMapping
    public Message ask(@RequestAttribute(AuthInterceptor.USER_ID) UUID userId, @Valid @RequestBody Ask body) {
        return coach.ask(userId, body.text().trim(), body.lang() == null ? "en" : body.lang());
    }

    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void clear(@RequestAttribute(AuthInterceptor.USER_ID) UUID userId) {
        coach.clear(userId);
    }
}
