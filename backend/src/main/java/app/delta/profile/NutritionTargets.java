package app.delta.profile;

import app.delta.onboarding.AppUser;
import app.delta.onboarding.Goal;

import java.util.Optional;

/** Daily calorie and macro targets. Mifflin-St Jeor BMR x activity factor, adjusted for goal. */
public record NutritionTargets(int kcal, int proteinG, int fatG, int carbsG, boolean custom) {

    public static Optional<NutritionTargets> of(AppUser u, int currentYear) {
        if (u.getWeightKg() == null) {
            return Optional.ofNullable(u.getCalorieTarget()).map(k -> split(k, 70, true));
        }
        double weight = u.getWeightKg().doubleValue();
        if (u.getCalorieTarget() != null) {
            return Optional.of(split(u.getCalorieTarget(), weight, true));
        }
        if (u.getSex() == null || u.getBirthYear() == null || u.getHeightCm() == null) return Optional.empty();

        int age = Math.max(18, currentYear - u.getBirthYear());
        double bmr = 10 * weight + 6.25 * u.getHeightCm() - 5 * age + ("MALE".equals(u.getSex()) ? 5 : -161);
        double activity = switch (u.getDaysPerWeek()) {
            case 1, 2 -> 1.375;
            case 3, 4 -> 1.465;
            case 5 -> 1.55;
            default -> 1.725;
        };
        int goalAdjust = u.getGoal() == Goal.BUILD_MUSCLE ? 300 : u.getGoal() == Goal.GET_STRONGER ? 150 : 0;
        int kcal = (int) (Math.round((bmr * activity + goalAdjust) / 10.0) * 10);
        return Optional.of(split(kcal, weight, false));
    }

    static NutritionTargets split(int kcal, double weightKg, boolean custom) {
        int protein = (int) Math.round(Math.min(weightKg * 1.8, kcal * 0.35 / 4));
        int fat = (int) Math.round(kcal * 0.27 / 9);
        int carbs = Math.max(0, (int) Math.round((kcal - protein * 4 - fat * 9) / 4.0));
        return new NutritionTargets(kcal, protein, fat, carbs, custom);
    }
}
