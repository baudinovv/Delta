package app.delta.log;

import app.delta.common.AuthInterceptor;
import app.delta.log.LogDtos.LoggedSet;
import app.delta.log.LogDtos.NewSet;
import app.delta.log.LogDtos.TodayLog;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/log")
public class LogController {

    private final LogService log;

    public LogController(LogService log) {
        this.log = log;
    }

    @GetMapping("/today")
    public TodayLog today(@RequestAttribute(AuthInterceptor.USER_ID) UUID userId) {
        return log.today(userId);
    }

    @PostMapping("/sets")
    @ResponseStatus(HttpStatus.CREATED)
    public LoggedSet logSet(@RequestAttribute(AuthInterceptor.USER_ID) UUID userId,
                            @Valid @RequestBody NewSet body) {
        return log.logSet(userId, body);
    }

    @DeleteMapping("/sets/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@RequestAttribute(AuthInterceptor.USER_ID) UUID userId, @PathVariable UUID id) {
        log.deleteSet(userId, id);
    }
}
