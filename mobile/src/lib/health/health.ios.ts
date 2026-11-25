import type * as HK from '@kingstinct/react-native-healthkit';

import { isExpoGo } from './expo-go';
import { dayStarts, DELTA_MARKER, localDay, nextDay, startOfDay, type HealthAdapter, type HealthSample } from './types';

/** Loaded lazily: in Expo Go the native module doesn't exist and importing it would crash. */
const hk = (): typeof HK => require('@kingstinct/react-native-healthkit');

const STEPS = 'HKQuantityTypeIdentifierStepCount' as const;
const ENERGY = 'HKQuantityTypeIdentifierActiveEnergyBurned' as const;
const HEART = 'HKQuantityTypeIdentifierHeartRate' as const;
const WORKOUT = 'HKWorkoutTypeIdentifier' as const;

/** HealthKit workout activity enum value -> readable name ("traditionalStrengthTraining"). */
function activityName(type: number): string {
  const name = (hk().WorkoutActivityType as unknown as Record<number, string>)[type];
  return name ?? `type ${type}`;
}

async function dailyTotals(
  identifier: typeof STEPS | typeof ENERGY | typeof HEART,
  kind: HealthSample['kind'],
  stat: 'cumulativeSum' | 'discreteAverage',
  unit: string,
  days: number,
): Promise<HealthSample[]> {
  const from = dayStarts(days)[0];
  const rows = await hk().queryStatisticsCollectionForQuantity(identifier, [stat], from, { day: 1 }, {
    // the library narrows units per identifier; these are the standard ones for each type
    unit: unit as never,
    filter: { date: { startDate: from, endDate: new Date() } },
  });
  const out: HealthSample[] = [];
  for (const r of rows) {
    const q = stat === 'cumulativeSum' ? r.sumQuantity?.quantity : r.averageQuantity?.quantity;
    if (q == null || !r.startDate) continue;
    const start = startOfDay(new Date(r.startDate));
    out.push({
      kind,
      externalId: `${kind}:${localDay(start)}`,
      start: start.toISOString(),
      end: nextDay(start).toISOString(),
      value: Math.round(q * 10) / 10,
    });
  }
  return out;
}

export const health: HealthAdapter = {
  platform: 'IOS',

  async availability() {
    if (isExpoGo) return 'needs-build';
    try {
      return hk().isHealthDataAvailable() ? 'ready' : 'unsupported';
    } catch {
      return 'needs-build';
    }
  },

  async requestPermissions() {
    return hk().requestAuthorization({ toRead: [STEPS, ENERGY, HEART, WORKOUT], toShare: [WORKOUT] });
  },

  async read(days) {
    const samples: HealthSample[] = [
      ...(await dailyTotals(STEPS, 'STEPS', 'cumulativeSum', 'count', days)),
      ...(await dailyTotals(ENERGY, 'ACTIVE_ENERGY', 'cumulativeSum', 'kcal', days)),
      ...(await dailyTotals(HEART, 'HEART_RATE', 'discreteAverage', 'count/min', days)),
    ];
    const from = dayStarts(days)[0];
    const workouts = await hk().queryWorkoutSamples({ limit: 100, filter: { date: { startDate: from } } });
    for (const w of workouts) {
      let avgHr: number | undefined;
      try {
        const s = await w.getStatistic(HEART, 'count/min');
        avgHr = s?.averageQuantity?.quantity ? Math.round(s.averageQuantity.quantity) : undefined;
      } catch {
        avgHr = undefined;
      }
      const energy = w.totalEnergyBurned?.quantity;
      samples.push({
        kind: 'WORKOUT',
        externalId: w.uuid,
        start: new Date(w.startDate).toISOString(),
        end: new Date(w.endDate).toISOString(),
        workoutType: activityName(w.workoutActivityType),
        energyKcal: energy != null ? Math.round(energy) : undefined,
        avgHr: avgHr && avgHr >= 20 && avgHr <= 250 ? avgHr : undefined,
        sourceName: w.sourceRevision?.source?.name?.slice(0, 80),
        fromDelta: Boolean((w.metadata as Record<string, unknown> | undefined)?.[DELTA_MARKER]),
      });
    }
    return samples;
  },

  async writeSession(session, title) {
    const H = hk();
    await H.saveWorkoutSample(
      H.WorkoutActivityType.traditionalStrengthTraining,
      [],
      new Date(session.start),
      new Date(session.end),
      undefined,
      { [DELTA_MARKER]: session.date, HKWorkoutBrandName: 'Delta', DeltaTitle: title },
    );
  },
};
