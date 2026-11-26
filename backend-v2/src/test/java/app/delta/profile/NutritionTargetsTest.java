package app.delta.profile;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class NutritionTargetsTest {

    @Test
    void macrosAddUpToCalories() {
        NutritionTargets t = NutritionTargets.split(2500, 80, false);
        assertThat(t.proteinG()).isEqualTo(144);
        int fromMacros = t.proteinG() * 4 + t.fatG() * 9 + t.carbsG() * 4;
        assertThat(fromMacros).isBetween(2490, 2510);
    }

    @Test
    void proteinIsCappedForLowCalorieTargets() {
        NutritionTargets t = NutritionTargets.split(1200, 120, true);
        assertThat(t.proteinG()).isEqualTo(105);
        assertThat(t.carbsG()).isGreaterThanOrEqualTo(0);
    }
}
