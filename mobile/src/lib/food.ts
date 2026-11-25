import type { Food, Lang, Per100, Serving } from './api';

export type Nutrition = { kcal: number; proteinG: number; fatG: number; carbsG: number; fiberG?: number; sugarG?: number };

/** Nutrition of `grams` of a food whose values are per 100 g. */
export function nutritionFor(per100: Per100, grams: number): Nutrition {
  const k = grams / 100;
  return {
    kcal: Math.round(per100.kcal * k),
    proteinG: round1(per100.proteinG * k),
    fatG: round1(per100.fatG * k),
    carbsG: round1(per100.carbsG * k),
    fiberG: per100.fiberG == null ? undefined : round1(per100.fiberG * k),
    sugarG: per100.sugarG == null ? undefined : round1(per100.sugarG * k),
  };
}

export const round1 = (n: number) => Math.round(n * 10) / 10;

export const gramsLabel = (lang: Lang) => (lang === 'ru' ? '100 г' : '100 g');

/** Portions to pick from: the food's own servings, then 100 g. */
export function portionsOf(food: Food, lang: Lang): Serving[] {
  const own = food.servings.filter((s) => s.grams > 0);
  const has100 = own.some((s) => Math.abs(s.grams - 100) < 0.01 && /100/.test(s.label));
  return has100 ? own : [...own, { label: gramsLabel(lang), grams: 100 }];
}

/** What one tap on "+" adds: the first named portion, or 100 g. */
export function defaultPortion(food: Food, lang: Lang): Serving {
  return portionsOf(food, lang)[0];
}

/** "1 порция · 200 г", "2 × 1 шт · 110 г", "150 г" */
export function portionText(label: string | undefined, count: number | undefined, grams: number | null | undefined, lang: Lang) {
  const g = grams != null ? `${Math.round(grams)} ${lang === 'ru' ? 'г' : 'g'}` : '';
  if (!label || label === gramsLabel(lang)) return g;
  const c = count && Math.abs(count - 1) > 0.001 ? `${fmtNum(count)} × ` : '';
  return `${c}${label}${g ? ` · ${g}` : ''}`;
}

export const fmtNum = (n: number) => (Number.isInteger(n) ? String(n) : String(round1(n)).replace('.', ','));
