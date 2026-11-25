package app.delta.nutrition;

import app.delta.nutrition.FoodEntry.Meal;
import app.delta.nutrition.FoodEntry.Source;
import app.delta.profile.NutritionTargets;
import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public final class NutritionDtos {
    private NutritionDtos() {}

    /**
     * Either a catalog food (foodId + grams; nutrition is computed on the server) or a free-form item
     * (name + kcal + macros, e.g. from a photo estimate or manual entry).
     */
    public record NewEntry(
            UUID foodId,
            @Size(max = 120) String name,
            @Min(0) @Max(5000) Integer grams,
            @Min(0) @Max(10000) Integer kcal,
            @DecimalMin("0") @DecimalMax("1000") BigDecimal proteinG,
            @DecimalMin("0") @DecimalMax("1000") BigDecimal fatG,
            @DecimalMin("0") @DecimalMax("1000") BigDecimal carbsG,
            @Size(max = 60) String servingLabel,
            @DecimalMin("0.01") @DecimalMax("100") BigDecimal servingsCount
    ) {}

    public record NewEntries(
            LocalDate date,
            @NotNull Meal meal,
            Source source,
            @Pattern(regexp = "ru|en") String lang,
            @NotEmpty @Size(max = 20) List<@Valid NewEntry> items
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Entry(UUID id, Meal meal, String name, Integer grams, int kcal,
                        BigDecimal proteinG, BigDecimal fatG, BigDecimal carbsG, BigDecimal fiberG, BigDecimal sugarG,
                        Source source, UUID foodId, String servingLabel, BigDecimal servingsCount) {
        static Entry of(FoodEntry e) {
            return new Entry(e.getId(), e.getMeal(), e.getName(), e.getGrams(), e.getKcal(),
                    e.getProteinG(), e.getFatG(), e.getCarbsG(), e.getFiberG(), e.getSugarG(), e.getSource(),
                    e.getFoodId(), e.getServingLabel(), e.getServingsCount());
        }
    }

    public record Totals(int kcal, int proteinG, int fatG, int carbsG, int fiberG, int sugarG) {
        static Totals of(List<FoodEntry> entries) {
            int k = 0;
            double p = 0, f = 0, c = 0, fi = 0, s = 0;
            for (FoodEntry e : entries) {
                k += e.getKcal();
                p += e.getProteinG().doubleValue();
                f += e.getFatG().doubleValue();
                c += e.getCarbsG().doubleValue();
                if (e.getFiberG() != null) fi += e.getFiberG().doubleValue();
                if (e.getSugarG() != null) s += e.getSugarG().doubleValue();
            }
            return new Totals(k, (int) Math.round(p), (int) Math.round(f), (int) Math.round(c),
                    (int) Math.round(fi), (int) Math.round(s));
        }
    }

    public record Day(LocalDate date, NutritionTargets targets, Totals totals, List<Entry> entries,
                      int waterMl, int waterTargetMl) {}

    public record CopyMeal(@NotNull LocalDate fromDate, @NotNull Meal fromMeal,
                           @NotNull LocalDate toDate, @NotNull Meal toMeal) {}

    public record Water(LocalDate date, @NotNull @Min(-5000) @Max(5000) Integer deltaMl) {}

    public record WaterStatus(LocalDate date, int ml, int targetMl) {}

    public record ReportDay(LocalDate date, int kcal, int proteinG, int fatG, int carbsG, int fiberG, int sugarG,
                            int waterMl, int entries) {}

    public record TopFood(String name, int kcal, int times) {}

    /** Averages are over days that have at least one food entry. */
    public record Report(int days, NutritionTargets targets, List<ReportDay> byDay, int loggedDays, int avgKcal,
                         int avgProteinG, int avgFatG, int avgCarbsG, int avgFiberG, int avgSugarG, int avgWaterMl,
                         int proteinPct, int fatPct, int carbsPct, int daysOnTarget, List<TopFood> topFoods) {}

    public record AnalyzeRequest(
            @NotBlank @Size(max = 8_000_000) String imageBase64,
            @Pattern(regexp = "image/(jpeg|png|webp|heic)") String mimeType,
            @Pattern(regexp = "ru|en") String lang,
            @Size(max = 200) String hint
    ) {}

    public record AnalyzedItem(String name, Integer grams, int kcal, BigDecimal proteinG, BigDecimal fatG,
                               BigDecimal carbsG) {}

    public record Analysis(boolean food, String dish, List<AnalyzedItem> items, AnalysisTotals totals, String confidence,
                           String note, boolean demo) {}

    public record AnalysisTotals(int kcal, int proteinG, int fatG, int carbsG) {}
}
