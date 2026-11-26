export type BmiCategory = 'UNDER' | 'NORMAL' | 'OVER' | 'OBESE';

export const BMI_MIN = 10;
export const BMI_MAX = 60;

/** BMI = weight (kg) / height (m)^2, rounded to 1 decimal. */
export function calcBmi(heightCm: number, weightKg: number): number {
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

/** WHO categories for adults. */
export function bmiCategory(bmi: number): BmiCategory {
  if (bmi < 18.5) return 'UNDER';
  if (bmi < 25) return 'NORMAL';
  if (bmi < 30) return 'OVER';
  return 'OBESE';
}

/** Parses "22,5" / "22.5"; returns undefined for empty or invalid input. */
export function parseNum(s: string): number | undefined {
  const n = Number(s.replace(',', '.'));
  return s.trim() === '' || Number.isNaN(n) ? undefined : n;
}

export const bmiIsValid = (bmi: number | undefined) => bmi !== undefined && bmi >= BMI_MIN && bmi <= BMI_MAX;
