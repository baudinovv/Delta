package app.delta.plan;

import app.delta.common.AuthInterceptor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/** The weekly plan the AI coach made. 204 when there is none yet. */
@RestController
@RequestMapping("/api/plan")
public class PlanController {

    private final PlanService plans;

    public PlanController(PlanService plans) {
        this.plans = plans;
    }

    @GetMapping
    public ResponseEntity<PlanService.Plan> get(@RequestAttribute(AuthInterceptor.USER_ID) UUID userId) {
        return plans.get(userId).map(ResponseEntity::ok).orElse(ResponseEntity.noContent().build());
    }

    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@RequestAttribute(AuthInterceptor.USER_ID) UUID userId) {
        plans.delete(userId);
    }
}
