package app.delta.profile;

import app.delta.onboarding.Goal;

import java.math.BigDecimal;

/**
 * Baseline training advice from the BMI the user entered at sign-up.
 * The AI coach receives it as a starting point and adapts it; the demo client returns it as is.
 */
public final class ProgramAdvisor {

    public enum Category { UNDERWEIGHT, NORMAL, OVERWEIGHT, OBESE }

    private ProgramAdvisor() {}

    public static Category category(BigDecimal bmi) {
        double v = bmi.doubleValue();
        if (v < 18.5) return Category.UNDERWEIGHT;
        if (v < 25) return Category.NORMAL;
        if (v < 30) return Category.OVERWEIGHT;
        return Category.OBESE;
    }

    /** A short baseline program (plain text) for the BMI category, the goal and the days per week. */
    public static String baseline(BigDecimal bmi, Goal goal, int daysPerWeek, int minutes, boolean ru) {
        Category c = category(bmi);
        String split = daysPerWeek <= 3
                ? (ru ? "Фулбади (всё тело) %d раза в неделю".formatted(daysPerWeek)
                      : "Full-body workouts, %d days a week".formatted(daysPerWeek))
                : (ru ? "Сплит верх/низ, %d дней в неделю".formatted(daysPerWeek)
                      : "Upper/lower split, %d days a week".formatted(daysPerWeek));
        String time = ru ? "по ~%d мин".formatted(minutes) : "~%d min each".formatted(minutes);

        if (ru) {
            return switch (c) {
                case UNDERWEIGHT -> "ИМТ " + bmi + " (дефицит веса). Цель: набрать массу. " + split + ", " + time
                        + ". Базовые многосуставные: присед, жим лёжа, тяга, жим над головой, 3-4 подхода по 6-10 повторов. "
                        + "Кардио минимум (1 прогулка в день). Профицит калорий +300-400 ккал, белок 1,8-2 г на кг, спи 7-9 часов.";
                case NORMAL -> "ИМТ " + bmi + " (норма). " + split + ", " + time
                        + ". " + (goal == Goal.GENERAL_FITNESS
                                ? "Силовые 3 подхода по 8-12 + 1-2 лёгких кардио по 20-30 мин."
                                : "Многосуставные упражнения 3-4 подхода по 5-10 повторов, каждую неделю +1 повтор или +2,5 кг.")
                        + " Калории около нормы" + (goal == Goal.BUILD_MUSCLE ? " с небольшим профицитом +200-300 ккал." : ".");
                case OVERWEIGHT -> "ИМТ " + bmi + " (избыточный вес). " + split + ", " + time
                        + ". Силовые 3 подхода по 8-12 повторов + 2-3 раза в неделю лёгкое кардио 30-40 мин (быстрая ходьба, велосипед). "
                        + "Умеренный дефицит калорий -10-15%, белок 1,6-2 г на кг. Шаги: 8-10 тысяч в день.";
                case OBESE -> "ИМТ " + bmi + " (ожирение). Начни мягко: 2-3 тренировки в неделю по 30-40 мин. "
                        + "Тренажёры и упражнения с собственным весом (жим ногами, тяга блока, отжимания от скамьи), 2-3 подхода по 10-15 повторов, "
                        + "плюс ходьба 30-45 мин в день. Без прыжков и бега, пока вес не снизится. Дефицит калорий -10%, не ниже 1200 ккал. "
                        + "Перед стартом желательно обсудить нагрузку с врачом.";
            };
        }
        return switch (c) {
            case UNDERWEIGHT -> "BMI " + bmi + " (underweight). Goal: gain weight. " + split + ", " + time
                    + ". Base lifts: squat, bench, row, overhead press, 3-4 sets of 6-10 reps. Keep cardio minimal "
                    + "(one daily walk). Eat +300-400 kcal above maintenance, protein 1.8-2 g per kg, sleep 7-9 hours.";
            case NORMAL -> "BMI " + bmi + " (normal). " + split + ", " + time + ". "
                    + (goal == Goal.GENERAL_FITNESS
                            ? "Strength 3 sets of 8-12 + 1-2 easy cardio sessions of 20-30 min."
                            : "Compound lifts, 3-4 sets of 5-10 reps, add 1 rep or 2.5 kg each week.")
                    + " Eat around maintenance" + (goal == Goal.BUILD_MUSCLE ? " with a small +200-300 kcal surplus." : ".");
            case OVERWEIGHT -> "BMI " + bmi + " (overweight). " + split + ", " + time
                    + ". Strength 3 sets of 8-12 reps + 2-3 easy cardio sessions of 30-40 min (brisk walk, bike). "
                    + "Moderate deficit of 10-15%, protein 1.6-2 g per kg, 8-10k steps a day.";
            case OBESE -> "BMI " + bmi + " (obesity). Start gently: 2-3 workouts a week, 30-40 min. "
                    + "Machines and bodyweight moves (leg press, lat pulldown, incline push-ups), 2-3 sets of 10-15 reps, "
                    + "plus a 30-45 min walk daily. No jumping or running until weight drops. Deficit of about 10%, never below 1200 kcal. "
                    + "Talk to a doctor before you start.";
        };
    }
}
