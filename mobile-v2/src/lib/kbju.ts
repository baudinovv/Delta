export type Sex = 'MALE' | 'FEMALE';
export type Activity = 'SEDENTARY' | 'LIGHT' | 'MODERATE' | 'HIGH' | 'EXTREME';
export type KbjuGoal = 'LOSE' | 'MAINTAIN' | 'GAIN';

export const ACTIVITY_FACTOR: Record<Activity, number> = {
  SEDENTARY: 1.2,
  LIGHT: 1.375,
  MODERATE: 1.55,
  HIGH: 1.725,
  EXTREME: 1.9,
};

export const GOAL_ADJUST: Record<KbjuGoal, number> = { LOSE: 0.85, MAINTAIN: 1, GAIN: 1.1 };

export type KbjuResult = { bmr: number; tdee: number; kcal: number; proteinG: number; fatG: number; carbsG: number };

/**
 * Mifflin-St Jeor BMR x activity, adjusted for the goal (-15% / 0 / +10%).
 * Macros use the same split as the server: protein 1.8 g/kg (max 35% kcal), fat 27% kcal, rest carbs.
 * Never goes below 1200 kcal.
 */
export function calcKbju(p: {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activity: Activity;
  goal: KbjuGoal;
}): KbjuResult {
  const bmr = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + (p.sex === 'MALE' ? 5 : -161);
  const tdee = bmr * ACTIVITY_FACTOR[p.activity];
  const kcal = Math.max(1200, Math.round((tdee * GOAL_ADJUST[p.goal]) / 10) * 10);
  const proteinG = Math.round(Math.min(p.weightKg * 1.8, (kcal * 0.35) / 4));
  const fatG = Math.round((kcal * 0.27) / 9);
  const carbsG = Math.max(0, Math.round((kcal - proteinG * 4 - fatG * 9) / 4));
  return { bmr: Math.round(bmr), tdee: Math.round(tdee), kcal, proteinG, fatG, carbsG };
}
