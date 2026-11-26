package app.delta.log;

import app.delta.common.ApiException;
import app.delta.config.DeltaProperties;
import app.delta.log.LogDtos.LoggedSet;
import app.delta.log.LogDtos.NewSet;
import app.delta.log.LogDtos.PrefillRow;
import app.delta.log.LogDtos.TodayLog;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
public class LogService {

    public static final String NEW_EXERCISE_HINT = "start light, 10–12 reps";
    public static final String REPS_REQUIRED_MESSAGE = "Enter reps to save";

    private final SetLogRepository sets;
    private final DeltaProperties props;
    private final Clock clock;

    public LogService(SetLogRepository sets, DeltaProperties props, Clock clock) {
        this.sets = sets;
        this.props = props;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public TodayLog today(UUID userId) {
        Map<String, String> exercises = new LinkedHashMap<>();
        for (String e : sets.findExercisesInFirstLoggedOrder(userId)) exercises.putIfAbsent(key(e), e);
        for (String e : props.defaultExercises()) exercises.putIfAbsent(key(e), e);

        List<PrefillRow> rows = new ArrayList<>();
        for (String exercise : exercises.values()) {
            rows.add(sets.findFirstByUserIdAndExerciseIgnoreCaseOrderByPerformedAtDesc(userId, exercise)
                    .map(last -> new PrefillRow(exercise, last.getWeightKg(), last.getReps(), null))
                    .orElseGet(() -> new PrefillRow(exercise, null, null, NEW_EXERCISE_HINT)));
        }

        Instant startOfToday = LocalDate.now(clock.withZone(props.zone())).atStartOfDay(props.zone()).toInstant();
        List<LoggedSet> todaySets = sets
                .findByUserIdAndPerformedAtGreaterThanEqualOrderByPerformedAtAsc(userId, startOfToday)
                .stream().map(LoggedSet::of).toList();

        return new TodayLog(rows, todaySets);
    }

    @Transactional
    public LoggedSet logSet(UUID userId, NewSet req) {
        if (req.reps() == null) {
            throw ApiException.badRequest("REPS_REQUIRED", REPS_REQUIRED_MESSAGE);
        }
        if (req.reps() < 1 || req.reps() > 100) {
            throw ApiException.badRequest("REPS_OUT_OF_RANGE", "Reps must be between 1 and 100");
        }
        String exercise = canonicalName(userId, req.exercise());
        SetLog saved = sets.save(new SetLog(UUID.randomUUID(), userId, exercise,
                req.weightKg(), req.reps(), Instant.now(clock)));
        return LoggedSet.of(saved);
    }

    @Transactional
    public void deleteSet(UUID userId, UUID setId) {
        SetLog s = sets.findByIdAndUserId(setId, userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Set not found"));
        sets.delete(s);
    }

    private String canonicalName(UUID userId, String raw) {
        String cleaned = raw.trim().replaceAll("\\s+", " ");
        return sets.findFirstByUserIdAndExerciseIgnoreCaseOrderByPerformedAtDesc(userId, cleaned)
                .map(SetLog::getExercise)
                .orElseGet(() -> props.defaultExercises().stream()
                        .filter(d -> d.equalsIgnoreCase(cleaned)).findFirst().orElse(cleaned));
    }

    private static String key(String exercise) {
        return exercise.trim().toLowerCase(Locale.ROOT);
    }
}
