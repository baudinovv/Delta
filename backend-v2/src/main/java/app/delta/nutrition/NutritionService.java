package app.delta.nutrition;

import app.delta.common.ApiException;
import app.delta.config.DeltaProperties;
import app.delta.nutrition.FoodEntry.Source;
import app.delta.nutrition.NutritionDtos.Day;
import app.delta.nutrition.NutritionDtos.Entry;
import app.delta.nutrition.NutritionDtos.NewEntries;
import app.delta.nutrition.NutritionDtos.Totals;
import app.delta.onboarding.UserRepository;
import app.delta.profile.TargetService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Service
public class NutritionService {

    private final FoodEntryRepository entries;
    private final UserRepository users;
    private final TargetService targets;
    private final DeltaProperties props;
    private final Clock clock;

    public NutritionService(FoodEntryRepository entries, UserRepository users, TargetService targets,
                            DeltaProperties props, Clock clock) {
        this.entries = entries;
        this.users = users;
        this.targets = targets;
        this.props = props;
        this.clock = clock;
    }

    public LocalDate today() {
        return LocalDate.now(clock.withZone(props.zone()));
    }

    @Transactional(readOnly = true)
    public Day day(UUID userId, LocalDate date) {
        LocalDate d = date == null ? today() : date;
        var user = users.findById(userId).orElseThrow(ApiException::unauthorized);
        List<FoodEntry> list = entries.findByUserIdAndEatenOnOrderByCreatedAtAsc(userId, d);
        return new Day(d, targets.forUser(user), Totals.of(list), list.stream().map(Entry::of).toList());
    }

    @Transactional
    public List<Entry> add(UUID userId, NewEntries req) {
        LocalDate d = req.date() == null ? today() : req.date();
        if (d.isAfter(today().plusDays(1)) || d.isBefore(today().minusYears(1))) {
            throw ApiException.badRequest("BAD_DATE", "Pick a date within the last year.");
        }
        Source source = req.source() == null ? Source.MANUAL : req.source();
        Instant now = Instant.now(clock);
        return req.items().stream().map(i -> entries.save(new FoodEntry(UUID.randomUUID(), userId, d, now,
                        req.meal(), i.name().trim(), i.grams(), i.kcal(),
                        orZero(i.proteinG()), orZero(i.fatG()), orZero(i.carbsG()), source)))
                .map(Entry::of).toList();
    }

    @Transactional
    public void delete(UUID userId, UUID id) {
        FoodEntry e = entries.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Entry not found"));
        entries.delete(e);
    }

    private static BigDecimal orZero(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }
}
