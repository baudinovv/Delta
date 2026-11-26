package app.delta.nutrition;

import app.delta.nutrition.FoodEntry.Meal;
import app.delta.nutrition.FoodEntry.Source;
import app.delta.profile.NutritionTargets;
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

    public record NewEntry(
            @NotBlank @Size(max = 120) String name,
            @Min(0) @Max(5000) Integer grams,
            @NotNull @Min(0) @Max(10000) Integer kcal,
            @DecimalMin("0") @DecimalMax("1000") BigDecimal proteinG,
            @DecimalMin("0") @DecimalMax("1000") BigDecimal fatG,
            @DecimalMin("0") @DecimalMax("1000") BigDecimal carbsG
    ) {}

    public record NewEntries(
            LocalDate date,
            @NotNull Meal meal,
            Source source,
            @NotEmpty @Size(max = 20) List<@Valid NewEntry> items
    ) {}

    public record Entry(UUID id, Meal meal, String name, Integer grams, int kcal,
                        BigDecimal proteinG, BigDecimal fatG, BigDecimal carbsG, Source source) {
        static Entry of(FoodEntry e) {
            return new Entry(e.getId(), e.getMeal(), e.getName(), e.getGrams(), e.getKcal(),
                    e.getProteinG(), e.getFatG(), e.getCarbsG(), e.getSource());
        }
    }

    public record Totals(int kcal, int proteinG, int fatG, int carbsG) {
        static Totals of(List<FoodEntry> entries) {
            int k = 0;
            double p = 0, f = 0, c = 0;
            for (FoodEntry e : entries) {
                k += e.getKcal();
                p += e.getProteinG().doubleValue();
                f += e.getFatG().doubleValue();
                c += e.getCarbsG().doubleValue();
            }
            return new Totals(k, (int) Math.round(p), (int) Math.round(f), (int) Math.round(c));
        }
    }

    public record Day(LocalDate date, NutritionTargets targets, Totals totals, List<Entry> entries) {}

    public record AnalyzeRequest(
            @NotBlank @Size(max = 8_000_000) String imageBase64,
            @Pattern(regexp = "image/(jpeg|png|webp|heic)") String mimeType,
            @Pattern(regexp = "ru|en") String lang,
            @Size(max = 200) String hint
    ) {}

    public record AnalyzedItem(String name, Integer grams, int kcal, BigDecimal proteinG, BigDecimal fatG,
                               BigDecimal carbsG) {}

    public record Analysis(boolean food, String dish, List<AnalyzedItem> items, Totals totals, String confidence,
                           String note, boolean demo) {}
}
