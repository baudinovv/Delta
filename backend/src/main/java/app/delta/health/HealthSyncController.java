package app.delta.health;

import app.delta.common.AuthInterceptor;
import app.delta.health.HealthDtos.Consent;
import app.delta.health.HealthDtos.Session;
import app.delta.health.HealthDtos.Status;
import app.delta.health.HealthDtos.Summary;
import app.delta.health.HealthDtos.Sync;
import app.delta.health.HealthDtos.SyncResult;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/health")
public class HealthSyncController {

    private final HealthService health;

    public HealthSyncController(HealthService health) {
        this.health = health;
    }

    @GetMapping("/status")
    public Status status(@RequestAttribute(AuthInterceptor.USER_ID) UUID userId) {
        return health.status(userId);
    }

    @PutMapping("/consent")
    public Status consent(@RequestAttribute(AuthInterceptor.USER_ID) UUID userId, @Valid @RequestBody Consent body) {
        return health.setConsent(userId, body.consent());
    }

    @PostMapping("/sync")
    public SyncResult sync(@RequestAttribute(AuthInterceptor.USER_ID) UUID userId, @Valid @RequestBody Sync body) {
        return health.sync(userId, body);
    }

    @GetMapping("/summary")
    public Summary summary(@RequestAttribute(AuthInterceptor.USER_ID) UUID userId,
                           @RequestParam(defaultValue = "7") int days) {
        return health.summary(userId, days);
    }

    @GetMapping("/sessions")
    public List<Session> sessions(@RequestAttribute(AuthInterceptor.USER_ID) UUID userId,
                                  @RequestParam(defaultValue = "14") int days) {
        return health.sessions(userId, days);
    }

    @DeleteMapping("/data")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteData(@RequestAttribute(AuthInterceptor.USER_ID) UUID userId) {
        health.deleteData(userId);
    }
}
