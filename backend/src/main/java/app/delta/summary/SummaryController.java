package app.delta.summary;

import app.delta.common.AuthInterceptor;
import app.delta.config.DeltaProperties;
import app.delta.log.SetLogRepository;
import app.delta.summary.SummaryCalculator.SetEntry;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
public class SummaryController {

    private final SetLogRepository sets;
    private final DeltaProperties props;

    public SummaryController(SetLogRepository sets, DeltaProperties props) {
        this.sets = sets;
        this.props = props;
    }

    @GetMapping("/api/summary/weekly")
    @Transactional(readOnly = true)
    public WeeklySummary weekly(@RequestAttribute(AuthInterceptor.USER_ID) UUID userId) {
        List<SetEntry> entries = sets.findByUserIdOrderByPerformedAtAsc(userId).stream()
                .map(s -> new SetEntry(s.getExercise(), s.getWeightKg(), s.getReps(), s.getPerformedAt()))
                .toList();
        return SummaryCalculator.calculate(entries, props.zone());
    }
}
