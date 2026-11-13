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
};

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
    throw new ApiError(0, 'NETWORK', `Can't reach the server at ${API_URL}. Check your connection.`);
  }
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, body?.code ?? 'ERROR', body?.message ?? `Request failed (${res.status})`);
  }
  return body as T;
}

export const api = {
  onboard: (req: OnboardingRequest) =>
    request<OnboardingResponse>('/api/onboarding', { method: 'POST', body: JSON.stringify(req) }),

  me: (token: string) => request<{ userId: string }>('/api/me', { token }),

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
