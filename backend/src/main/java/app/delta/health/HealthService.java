package app.delta.health;

import app.delta.common.ApiException;
import app.delta.config.DeltaProperties;
import app.delta.health.HealthDtos.Day;
import app.delta.health.HealthDtos.Sample;
import app.delta.health.HealthDtos.Session;
import app.delta.health.HealthDtos.Status;
import app.delta.health.HealthDtos.Summary;
import app.delta.health.HealthDtos.Sync;
import app.delta.health.HealthDtos.SyncResult;
import app.delta.health.HealthDtos.Workout;
import app.delta.log.SetLog;
import app.delta.log.SetLogRepository;
import app.delta.onboarding.AppUser;
import app.delta.onboarding.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class HealthService {

    private final HealthSampleRepository samples;
    private final UserRepository users;
    private final SetLogRepository sets;
    private final DeltaProperties props;
    private final Clock clock;

    public HealthService(HealthSampleRepository samples, UserRepository users, SetLogRepository sets,
                         DeltaProperties props, Clock clock) {
        this.samples = samples;
        this.users = users;
        this.sets = sets;
        this.props = props;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public Status status(UUID userId) {
        AppUser u = user(userId);
        return new Status(u.getHealthConsentAt() != null, u.getHealthConsentAt(), u.getHealthSyncedAt(),
                samples.countByUserId(userId));
    }

    /** Revoking consent also deletes everything synced so far. */
    @Transactional
    public Status setConsent(UUID userId, boolean consent) {
        AppUser u = user(userId);
        if (consent) {
            if (u.getHealthConsentAt() == null) u.setHealthConsentAt(Instant.now(clock));
        } else {
            u.setHealthConsentAt(null);
            u.setHealthSyncedAt(null);
            samples.deleteAllForUser(userId);
        }
        return status(userId);
    }

    @Transactional
    public void deleteData(UUID userId) {
        samples.deleteAllForUser(userId);
        user(userId).setHealthSyncedAt(null);
    }

    /** Upsert by (user, platform, externalId): re-syncing the same records updates them instead of duplicating. */
    @Transactional
    public SyncResult sync(UUID userId, Sync req) {
        AppUser u = user(userId);
        if (u.getHealthConsentAt() == null) {
            throw new ApiException(HttpStatus.FORBIDDEN, "HEALTH_CONSENT_REQUIRED",
                    "Allow Delta to store your health data first.");
        }
        Instant now = Instant.now(clock);
        Map<String, HealthSample> existing = samples.findByUserIdAndPlatformAndExternalIdIn(userId, req.platform(),
                        req.samples().stream().map(Sample::externalId).toList())
                .stream().collect(Collectors.toMap(HealthSample::getExternalId, Function.identity()));
        int inserted = 0, updated = 0;
        for (Sample s : req.samples()) {
            if (s.end().isBefore(s.start())) {
                throw ApiException.badRequest("BAD_SAMPLE", "A sample ends before it starts.");
            }
            HealthSample row = existing.get(s.externalId());
            if (row == null) {
                row = new HealthSample(UUID.randomUUID(), userId, req.platform(), s.kind(), s.externalId());
                existing.put(s.externalId(), row);
                inserted++;
            } else {
                updated++;
            }
            row.update(s.start(), s.end(), s.value(), s.workoutType(), s.energyKcal(), s.avgHr(), s.sourceName(),
                    Boolean.TRUE.equals(s.fromDelta()), now);
            samples.save(row);
        }
        u.setHealthSyncedAt(now);
        return new SyncResult(inserted, updated, now);
    }

    @Transactional(readOnly = true)
    public Summary summary(UUID userId, int days) {
        AppUser u = user(userId);
        int n = Math.max(1, Math.min(days, 30));
        LocalDate today = LocalDate.now(clock.withZone(props.zone()));
        LocalDate from = today.minusDays(n - 1L);

        Map<LocalDate, int[]> byDay = new LinkedHashMap<>(); // steps, kcal, hr, workouts, hasSteps, hasKcal, hasHr
        for (LocalDate d = from; !d.isAfter(today); d = d.plusDays(1)) byDay.put(d, new int[7]);
        List<Workout> workouts = new ArrayList<>();
        for (HealthSample s : samples.findByUserIdAndStartAtGreaterThanEqualOrderByStartAtAsc(userId,
                from.atStartOfDay(props.zone()).toInstant())) {
            LocalDate d = s.getStartAt().atZone(props.zone()).toLocalDate();
            int[] v = byDay.get(d);
            if (v == null) continue;
            switch (s.getKind()) {
                case STEPS -> { v[0] += intOf(s); v[4] = 1; }
                case ACTIVE_ENERGY -> { v[1] += intOf(s); v[5] = 1; }
                case HEART_RATE -> { v[2] = intOf(s); v[6] = 1; }
                case WORKOUT -> {
                    v[3]++;
                    if (!s.isFromDelta()) {
                        workouts.add(new Workout(d, s.getStartAt(), s.getEndAt(), s.getWorkoutType(),
                                (int) Duration.between(s.getStartAt(), s.getEndAt()).toMinutes(),
                                s.getEnergyKcal() == null ? null : s.getEnergyKcal().intValue(), s.getAvgHr(),
                                s.getSourceName(), s.getPlatform()));
                    }
                }
            }
        }
        List<Day> list = new ArrayList<>();
        long stepsSum = 0, kcalSum = 0;
        int stepsDays = 0, kcalDays = 0;
        for (var e : byDay.entrySet()) {
            int[] v = e.getValue();
            list.add(new Day(e.getKey(), v[4] == 1 ? v[0] : null, v[5] == 1 ? v[1] : null, v[6] == 1 ? v[2] : null, v[3]));
            if (v[4] == 1) { stepsSum += v[0]; stepsDays++; }
            if (v[5] == 1) { kcalSum += v[1]; kcalDays++; }
        }
        Day t = list.get(list.size() - 1);
        Collections.reverse(workouts);
        return new Summary(u.getHealthConsentAt() != null, u.getHealthSyncedAt(), list, workouts,
                stepsDays == 0 ? null : (int) (stepsSum / stepsDays), kcalDays == 0 ? null : (int) (kcalSum / kcalDays),
                t.steps(), t.activeKcal());
    }

    /**
     * Each day with logged sets is one strength session: from a few minutes before the first set to a minute after
     * the last (at least 15 minutes), so it looks right next to watch workouts.
     */
    @Transactional(readOnly = true)
    public List<Session> sessions(UUID userId, int days) {
        int n = Math.max(1, Math.min(days, 30));
        LocalDate from = LocalDate.now(clock.withZone(props.zone())).minusDays(n - 1L);
        Map<LocalDate, List<SetLog>> byDay = new LinkedHashMap<>();
        for (SetLog s : sets.findByUserIdAndPerformedAtGreaterThanEqualOrderByPerformedAtAsc(userId,
                from.atStartOfDay(props.zone()).toInstant())) {
            byDay.computeIfAbsent(s.getPerformedAt().atZone(props.zone()).toLocalDate(), k -> new ArrayList<>()).add(s);
        }
        List<Session> out = new ArrayList<>();
        byDay.forEach((d, list) -> {
            Instant first = list.get(0).getPerformedAt();
            Instant last = list.get(list.size() - 1).getPerformedAt();
            Instant start = first.minus(Duration.ofMinutes(5));
            Instant end = last.plus(Duration.ofMinutes(1));
            if (Duration.between(start, end).toMinutes() < 15) end = start.plus(Duration.ofMinutes(15));
            int volume = (int) Math.round(list.stream().mapToDouble(s -> s.getWeightKg().doubleValue() * s.getReps()).sum());
            List<String> exercises = new ArrayList<>(list.stream().map(SetLog::getExercise)
                    .collect(Collectors.toCollection(LinkedHashSet::new)));
            out.add(new Session(d, start, end, list.size(), volume, exercises));
        });
        return out;
    }

    /** Today's steps and active energy for the dashboard; null when not connected or nothing synced. */
    @Transactional(readOnly = true)
    public Map<String, Integer> today(UUID userId) {
        Map<String, Integer> out = new HashMap<>();
        LocalDate today = LocalDate.now(clock.withZone(props.zone()));
        for (HealthSample s : samples.findByUserIdAndStartAtGreaterThanEqualOrderByStartAtAsc(userId,
                today.atStartOfDay(props.zone()).toInstant())) {
            if (s.getKind() == HealthSample.Kind.STEPS) out.merge("steps", intOf(s), Integer::sum);
            if (s.getKind() == HealthSample.Kind.ACTIVE_ENERGY) out.merge("activeKcal", intOf(s), Integer::sum);
        }
        return out;
    }

    private static int intOf(HealthSample s) {
        return s.getValue() == null ? 0 : (int) Math.round(s.getValue().doubleValue());
    }

    private AppUser user(UUID userId) {
        return users.findById(userId).orElseThrow(ApiException::unauthorized);
    }
}
