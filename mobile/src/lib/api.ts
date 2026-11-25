// use LAN ip of your machine when running on a phone
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';

export type Goal = 'GET_STRONGER' | 'BUILD_MUSCLE' | 'GENERAL_FITNESS';

export type Screening = {
  heartCondition: boolean;
  chestPain: boolean;
  dizziness: boolean;
  injury: boolean;
  pregnant: boolean;
};

export type OnboardingRequest = {
  adult: boolean;
  screening: Screening;
  consent: boolean;
  goal: Goal;
  daysPerWeek: number;
  minutesPerSession: number;
  body?: Body;
  account: { name: string; email: string; password: string };
};

export type Sex = 'MALE' | 'FEMALE';
export type Body = { sex?: Sex; birthYear?: number; heightCm?: number; weightKg?: number };

export type Targets = { kcal: number; proteinG: number; fatG: number; carbsG: number; custom: boolean };

export type Me = {
  userId: string;
  name?: string | null;
  email?: string | null;
  createdAt: string;
  goal: Goal;
  daysPerWeek: number;
  minutesPerSession: number;
  sex?: Sex | null;
  birthYear?: number | null;
  heightCm?: number | null;
  weightKg?: number | null;
  calorieTarget?: number | null;
  targets?: Targets | null;
};

export type ProfileUpdate = Body & {
  name?: string;
  goal: Goal;
  daysPerWeek: number;
  minutesPerSession: number;
  calorieTarget?: number | null;
};

export type Meal = 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';
export type FoodItem = {
  name: string;
  grams?: number | null;
  kcal: number;
  proteinG?: number;
  fatG?: number;
  carbsG?: number;
};
export type FoodEntry = Required<Pick<FoodItem, 'name' | 'kcal'>> &
  FoodItem & { id: string; meal: Meal; source: 'MANUAL' | 'PHOTO' };
export type Totals = { kcal: number; proteinG: number; fatG: number; carbsG: number };
export type FoodDay = { date: string; targets?: Targets | null; totals: Totals; entries: FoodEntry[] };
export type Analysis = {
  food: boolean;
  dish: string;
  items: FoodItem[];
  totals: Totals;
  confidence: 'low' | 'medium' | 'high';
  note?: string | null;
  demo: boolean;
};

export type CoachMessage = { id: string; role: 'user' | 'coach'; content: string; createdAt: string };
export type CoachThread = { messages: CoachMessage[]; demo: boolean };

export type DashboardDay = { date: string; kcal: number; sets: number; volumeKg: number };
export type Lift = { exercise: string; weightKg: number; reps: number; e1rmByWeek: (number | null)[] };
export type Dashboard = {
  date: string;
  targets?: Targets | null;
  kcalToday: number;
  proteinToday: number;
  fatToday: number;
  carbsToday: number;
  setsToday: number;
  workoutsThisWeek: number;
  plannedPerWeek: number;
  streakDays: number;
  days: DashboardDay[];
  lifts: Lift[];
};

export type Lang = 'ru' | 'en';

export type OnboardingResponse =
  | { status: 'ADMITTED'; userId: string; token: string }
  | { status: 'REFERRED'; reason: 'UNDER_18' | 'HEALTH_SCREENING'; message: string };

export type PrefillRow = { exercise: string; weightKg?: number; reps?: number; hint?: string };
export type LoggedSet = { id: string; exercise: string; weightKg: number; reps: number; performedAt: string };
export type TodayLog = { rows: PrefillRow[]; todaySets: LoggedSet[] };

export type BestSet = { weekStart: string; weightKg: number; reps: number };
export type Trend = 'UP' | 'FLAT' | 'DOWN' | 'NEW';
export type ExerciseSummary = {
  exercise: string;
  first?: BestSet;
  latest: BestSet;
  trend?: Trend;
  weeks?: BestSet[];
};
export type WeeklySummary = {
  mode: 'BASELINE' | 'COMPARISON';
  message?: string;
  weeksLogged: number;
  exercises: ExerciseSummary[];
};

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit & { token?: string | null } = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (init.token) headers.Authorization = `Bearer ${init.token}`;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, 'NETWORK', 'No connection. Try again.');
  }
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, body?.code ?? 'ERROR', body?.message ?? `Request failed (${res.status})`);
  }
  return body as T;
}

export const api = {
  register: (req: OnboardingRequest) =>
    request<OnboardingResponse>('/api/auth/register', { method: 'POST', body: JSON.stringify(req) }),

  login: (email: string, password: string) =>
    request<{ userId: string; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  logout: (token: string) => request<void>('/api/auth/logout', { method: 'POST', token }),

  changePassword: (token: string, currentPassword: string, newPassword: string) =>
    request<void>('/api/auth/password', {
      method: 'POST',
      token,
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  deleteAccount: (token: string, password: string) =>
    request<void>('/api/auth/delete-account', { method: 'POST', token, body: JSON.stringify({ password }) }),

  me: (token: string) => request<Me>('/api/me', { token }),

  updateProfile: (token: string, body: ProfileUpdate) =>
    request<Me>('/api/profile', { method: 'PUT', token, body: JSON.stringify(body) }),

  dashboard: (token: string) => request<Dashboard>('/api/dashboard', { token }),

  foodDay: (token: string, date?: string) =>
    request<FoodDay>(`/api/nutrition/day${date ? `?date=${date}` : ''}`, { token }),

  addFood: (token: string, body: { date?: string; meal: Meal; source?: 'MANUAL' | 'PHOTO'; items: FoodItem[] }) =>
    request<FoodEntry[]>('/api/nutrition/entries', { method: 'POST', token, body: JSON.stringify(body) }),

  deleteFood: (token: string, id: string) =>
    request<void>(`/api/nutrition/entries/${id}`, { method: 'DELETE', token }),

  analyzeFood: (token: string, imageBase64: string, lang: Lang, hint?: string) =>
    request<Analysis>('/api/nutrition/analyze', {
      method: 'POST',
      token,
      body: JSON.stringify({ imageBase64, mimeType: 'image/jpeg', lang, hint }),
    }),

  coachThread: (token: string) => request<CoachThread>('/api/coach/messages', { token }),

  askCoach: (token: string, text: string, lang: Lang) =>
    request<CoachMessage>('/api/coach/messages', { method: 'POST', token, body: JSON.stringify({ text, lang }) }),

  clearCoach: (token: string) => request<void>('/api/coach/messages', { method: 'DELETE', token }),

  today: (token: string) => request<TodayLog>('/api/log/today', { token }),

  logSet: (token: string, exercise: string, weightKg: number, reps: number) =>
    request<LoggedSet>('/api/log/sets', {
      method: 'POST',
      token,
      body: JSON.stringify({ exercise, weightKg, reps }),
    }),

  deleteSet: (token: string, id: string) => request<void>(`/api/log/sets/${id}`, { method: 'DELETE', token }),

  weeklySummary: (token: string) => request<WeeklySummary>('/api/summary/weekly', { token }),
};
