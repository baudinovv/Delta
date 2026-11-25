package app.delta.food;

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
import java.util.List;
import java.util.UUID;

public final class FoodDtos {
    private FoodDtos() {}

    public record Per100(BigDecimal kcal, BigDecimal proteinG, BigDecimal fatG, BigDecimal carbsG,
                         BigDecimal fiberG, BigDecimal sugarG) {}

    public record ServingDto(String label, double grams) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Ingredient(UUID foodId, String name, BigDecimal grams, int kcal) {}

    /** id is null for an Open Food Facts result that hasn't been imported yet (open it by barcode). */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record FoodDto(UUID id, Food.Source source, String barcode, String name, String brand, Per100 per100,
                          List<ServingDto> servings, boolean favorite, boolean own, List<Ingredient> ingredients) {}

    public record SearchResult(List<FoodDto> local, List<FoodDto> online) {}

    public record RecentFood(FoodDto food, String servingLabel, BigDecimal grams, BigDecimal servingsCount) {}

    public record NewServing(@NotBlank @Size(max = 40) String label,
                             @NotNull @DecimalMin("1") @DecimalMax("5000") BigDecimal grams) {}

    public record NewFood(
            @NotBlank @Size(max = 160) String name,
            @Size(max = 120) String brand,
            @Pattern(regexp = "\\d{8,14}") String barcode,
            @NotNull @DecimalMin("0") @DecimalMax("900") BigDecimal kcal,
            @DecimalMin("0") @DecimalMax("100") BigDecimal proteinG,
            @DecimalMin("0") @DecimalMax("100") BigDecimal fatG,
            @DecimalMin("0") @DecimalMax("100") BigDecimal carbsG,
            @DecimalMin("0") @DecimalMax("100") BigDecimal fiberG,
            @DecimalMin("0") @DecimalMax("100") BigDecimal sugarG,
            @Valid NewServing serving
    ) {}

    public record NewIngredient(@NotNull UUID foodId,
                                @NotNull @DecimalMin("1") @DecimalMax("10000") BigDecimal grams) {}

    public record NewRecipe(
            @NotBlank @Size(max = 160) String name,
            @NotNull @Min(1) @Max(50) Integer portions,
            @NotEmpty @Size(max = 40) List<@Valid NewIngredient> ingredients
    ) {}
}
