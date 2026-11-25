/** Shared shapes for Apple Health (iOS) and Health Connect (Android). */

export type HealthAvailability =
  | 'ready'
  /** Running in Expo Go: native health modules need an installed (dev/EAS) build. */
  | 'needs-build'
  /** Android: the Health Connect app is missing (Android 9–13) or outdated. */
  | 'install-app'
  | 'update-app'
  /** Web, or a device without Health data (e.g. iPad). */
  | 'unsupported';

export type HealthPlatform = 'IOS' | 'ANDROID';

export type SampleKind = 'WORKOUT' | 'STEPS' | 'ACTIVE_ENERGY' | 'HEART_RATE';

/** What we send to POST /api/health/sync. Daily totals use externalId "<KIND>:<yyyy-mm-dd>". */
export type HealthSample = {
  kind: SampleKind;
  externalId: string;
  start: string;
  end: string;
  value?: number;
  workoutType?: string;
  energyKcal?: number;
  avgHr?: number;
  sourceName?: string;
  fromDelta?: boolean;
};

/** A day of logged sets, written to Health as one strength workout. */
export type DeltaSession = {
  date: string;
  start: string;
  end: string;
  sets: number;
  volumeKg: number;
  exercises: string[];
};

export interface HealthAdapter {
  platform: HealthPlatform | null;
  availability(): Promise<HealthAvailability>;
  /** Shows the system permission sheet. Returns true if at least reading was allowed. */
  requestPermissions(): Promise<boolean>;
  /** Daily totals and workouts for the last `days` days, today included. */
  read(days: number): Promise<HealthSample[]>;
  writeSession(session: DeltaSession, title: string): Promise<void>;
  /** Opens the app/store page needed to fix a non-ready state. */
  openFix?(state: HealthAvailability): void;
}

export const localDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Start of each local day from `days - 1` days ago up to today. */
export function dayStarts(days: number): Date[] {
  const today = startOfDay(new Date());
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (days - 1 - i));
    return d;
  });
}

export const nextDay = (d: Date) => {
  const n = new Date(d);
  n.setDate(n.getDate() + 1);
  return n;
};

/** Marker stored on workouts we write, so they aren't read back as "watch workouts". */
export const DELTA_MARKER = 'DeltaSessionDate';
