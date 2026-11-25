package app.delta.nutrition;

import app.delta.common.ApiException;
import app.delta.config.DeltaProperties;
import app.delta.food.Food;
import app.delta.food.FoodService;
import app.delta.food.WaterDay;
import app.delta.food.WaterDayRepository;
import app.delta.nutrition.FoodEntry.Source;
import app.delta.nutrition.NutritionDtos.CopyMeal;
import app.delta.nutrition.NutritionDtos.Day;
import app.delta.nutrition.NutritionDtos.Entry;
import app.delta.nutrition.NutritionDtos.NewEntries;
import app.delta.nutrition.NutritionDtos.NewEntry;
import app.delta.nutrition.NutritionDtos.Report;
import app.delta.nutrition.NutritionDtos.ReportDay;
import app.delta.nutrition.NutritionDtos.TopFood;
import app.delta.nutrition.NutritionDtos.Totals;
import app.delta.nutrition.NutritionDtos.WaterStatus;
import app.delta.onboarding.AppUser;
import app.delta.onboarding.UserRepository;
import app.delta.profile.NutritionTargets;
import app.delta.profile.TargetService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class NutritionService {

    private final FoodEntryRepository entries;
    private final UserRepository users;
    private final TargetService targets;
    private final FoodService foods;
    private final WaterDayRepository water;
    private final DeltaProperties props;
    private final Clock clock;

    public NutritionService(FoodEntryRepository entries, UserRepository users, TargetService targets,
                            FoodService foods, WaterDayRepository water, DeltaProperties props, Clock clock) {
        this.entries = entries;
        this.users = users;
        this.targets = targets;
        this.foods = foods;
        this.water = water;
        this.props = props;
        this.clock = clock;
    }

    public LocalDate today() {
        return LocalDate.now(clock.withZone(props.zone()));
    }

    @Transactional(readOnly = true)
    public Day day(UUID userId, LocalDate date) {
        LocalDate d = date == null ? today() : date;
        AppUser user = users.findById(userId).orElseThrow(ApiException::unauthorized);
        List<FoodEntry> list = entries.findByUserIdAndEatenOnOrderByCreatedAtAsc(userId, d);
        int ml = water.findById(new WaterDay.Key(userId, d)).map(WaterDay::getMl).orElse(0);
        return new Day(d, targets.forUser(user), Totals.of(list), list.stream().map(Entry::of).toList(),
                ml, waterTarget(user));
    }

    @Transactional
    public List<Entry> add(UUID userId, NewEntries req) {
        LocalDate d = checkDate(req.date());
        String lang = "en".equals(req.lang()) ? "en" : "ru";
        Instant now = Instant.now(clock);
        List<Entry> out = new ArrayList<>();
        for (NewEntry i : req.items()) {
            FoodEntry e = i.foodId() != null ? fromCatalog(userId, d, now, req.meal(), i, lang)
                    : freeForm(userId, d, now, req.meal(), i, req.source() == null ? Source.MANUAL : req.source());
            out.add(Entry.of(entries.save(e)));
        }
        return out;
    }

    /** Nutrition is computed here from the catalog, so the client can't log wrong numbers by mistake. */
    private FoodEntry fromCatalog(UUID userId, LocalDate d, Instant now, FoodEntry.Meal meal, NewEntry i, String lang) {
        if (i.grams() == null || i.grams() <= 0) throw ApiException.badRequest("GRAMS_REQUIRED", "Enter the amount.");
        Food f = foods.visible(userId, i.foodId());
        double k = i.grams() / 100.0;
        String name = f.name(lang) + (f.getBrand() != null ? " (" + f.getBrand() + ")" : "");
        FoodEntry e = new FoodEntry(UUID.randomUUID(), userId, d, now, meal, cut(name), i.grams(),
                (int) Math.round(f.getKcal().doubleValue() * k),
                scale(f.getProteinG(), k), scale(f.getFatG(), k), scale(f.getCarbsG(), k), Source.CATALOG);
        e.linkFood(f.getId(), i.servingLabel(), i.servingsCount());
        e.setExtras(f.getFiberG() == null ? null : scale(f.getFiberG(), k),
                f.getSugarG() == null ? null : scale(f.getSugarG(), k));
        return e;
    }

    private static FoodEntry freeForm(UUID userId, LocalDate d, Instant now, FoodEntry.Meal meal, NewEntry i, Source source) {
        if (i.name() == null || i.name().isBlank() || i.kcal() == null) {
            throw ApiException.badRequest("NAME_AND_KCAL_REQUIRED", "Enter a name and calories.");
        }
        return new FoodEntry(UUID.randomUUID(), userId, d, now, meal, i.name().trim(), i.grams(), i.kcal(),
                orZero(i.proteinG()), orZero(i.fatG()), orZero(i.carbsG()), source == Source.CATALOG ? Source.MANUAL : source);
    }

    /** "Same as yesterday's breakfast": copies one meal's entries to another day/meal. */
    @Transactional
    public List<Entry> copy(UUID userId, CopyMeal req) {
        LocalDate to = checkDate(req.toDate());
        Instant now = Instant.now(clock);
        List<Entry> out = new ArrayList<>();
        for (FoodEntry src : entries.findByUserIdAndEatenOnAndMealOrderByCreatedAtAsc(userId, req.fromDate(), req.fromMeal())) {
            FoodEntry e = new FoodEntry(UUID.randomUUID(), userId, to, now, req.toMeal(), src.getName(), src.getGrams(),
                    src.getKcal(), src.getProteinG(), src.getFatG(), src.getCarbsG(), src.getSource());
            e.linkFood(src.getFoodId(), src.getServingLabel(), src.getServingsCount());
            e.setExtras(src.getFiberG(), src.getSugarG());
            out.add(Entry.of(entries.save(e)));
        }
        if (out.isEmpty()) throw ApiException.badRequest("NOTHING_TO_COPY", "That meal is empty.");
        return out;
    }

    @Transactional
    public void delete(UUID userId, UUID id) {
        FoodEntry e = entries.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Entry not found"));
        entries.delete(e);
    }

    @Transactional
    public WaterStatus addWater(UUID userId, LocalDate date, int deltaMl) {
        LocalDate d = checkDate(date);
        AppUser user = users.findById(userId).orElseThrow(ApiException::unauthorized);
        var key = new WaterDay.Key(userId, d);
        var row = water.findById(key).orElseGet(() -> new WaterDay(userId, d, 0));
        row.setMl(Math.max(0, Math.min(20000, row.getMl() + deltaMl)));
        water.save(row);
        return new WaterStatus(d, row.getMl(), waterTarget(user));
    }

    @Transactional(readOnly = true)
    public Report report(UUID userId, int days) {
        int n = days <= 7 ? 7 : days <= 14 ? 14 : 30;
        AppUser user = users.findById(userId).orElseThrow(ApiException::unauthorized);
        NutritionTargets t = targets.forUser(user);
        LocalDate to = today();
        LocalDate from = to.minusDays(n - 1L);

        Map<LocalDate, List<FoodEntry>> byDay = new HashMap<>();
        Map<String, int[]> top = new HashMap<>(); // kcal, times
        for (FoodEntry e : entries.findByUserIdAndEatenOnBetween(userId, from, to)) {
            byDay.computeIfAbsent(e.getEatenOn(), k -> new ArrayList<>()).add(e);
            int[] v = top.computeIfAbsent(e.getName(), k -> new int[2]);
            v[0] += e.getKcal();
            v[1]++;
        }
        Map<LocalDate, Integer> waterByDay = new HashMap<>();
        water.findByUserIdAndDayBetween(userId, from, to).forEach(w -> waterByDay.put(w.getDay(), w.getMl()));

        List<ReportDay> list = new ArrayList<>();
        int logged = 0, onTarget = 0, waterDays = 0;
        long k = 0, p = 0, f = 0, c = 0, fi = 0, s = 0, w = 0;
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            List<FoodEntry> es = byDay.getOrDefault(d, List.of());
            Totals tt = Totals.of(es);
            int ml = waterByDay.getOrDefault(d, 0);
            list.add(new ReportDay(d, tt.kcal(), tt.proteinG(), tt.fatG(), tt.carbsG(), tt.fiberG(), tt.sugarG(), ml, es.size()));
            if (ml > 0) {
                waterDays++;
                w += ml;
            }
            if (es.isEmpty()) continue;
            logged++;
            k += tt.kcal();
            p += tt.proteinG();
            f += tt.fatG();
            c += tt.carbsG();
            fi += tt.fiberG();
            s += tt.sugarG();
            if (t != null && Math.abs(tt.kcal() - t.kcal()) <= t.kcal() * 0.1) onTarget++;
        }
        long macroKcal = p * 4 + f * 9 + c * 4;
        List<TopFood> topFoods = top.entrySet().stream()
                .sorted(Comparator.comparingInt((Map.Entry<String, int[]> e) -> e.getValue()[0]).reversed())
                .limit(5).map(e -> new TopFood(e.getKey(), e.getValue()[0], e.getValue()[1])).toList();
        return new Report(n, t, list, logged, avg(k, logged), avg(p, logged), avg(f, logged), avg(c, logged),
                avg(fi, logged), avg(s, logged), avg(w, waterDays),
                pct(p * 4, macroKcal), pct(f * 9, macroKcal), pct(c * 4, macroKcal), onTarget, topFoods);
    }

    /** About 33 ml per kg of body weight, 2 L if the weight is unknown; rounded to 50 ml. */
    static int waterTarget(AppUser u) {
        if (u.getWeightKg() == null) return 2000;
        return (int) (Math.round(u.getWeightKg().doubleValue() * 33 / 50.0) * 50);
    }

    private LocalDate checkDate(LocalDate date) {
        LocalDate d = date == null ? today() : date;
        if (d.isAfter(today().plusDays(1)) || d.isBefore(today().minusYears(1))) {
            throw ApiException.badRequest("BAD_DATE", "Pick a date within the last year.");
        }
        return d;
    }

    private static int avg(long sum, int n) {
        return n == 0 ? 0 : (int) Math.round((double) sum / n);
    }

    private static int pct(long part, long whole) {
        return whole == 0 ? 0 : (int) Math.round(100.0 * part / whole);
    }

    private static BigDecimal scale(BigDecimal per100, double k) {
        return BigDecimal.valueOf(per100.doubleValue() * k).setScale(1, RoundingMode.HALF_UP);
    }

    private static String cut(String s) {
        return s.length() > 120 ? s.substring(0, 120) : s;
    }

    private static BigDecimal orZero(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }
}
