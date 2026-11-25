import { Linking } from 'react-native';
import type * as HC from 'react-native-health-connect';

import { isExpoGo } from './expo-go';
import { dayStarts, DELTA_MARKER, localDay, nextDay, type HealthAdapter, type HealthSample } from './types';

/** Loaded lazily: Expo Go has no Health Connect native module. */
const hc = (): typeof HC => require('react-native-health-connect');

const HC_PACKAGE = 'com.google.android.apps.healthdata';
const DELTA_PACKAGE = 'app.delta.pilot';

const range = (start: Date, end: Date) => ({
  operator: 'between' as const,
  startTime: start.toISOString(),
  endTime: end.toISOString(),
});

/** Health Connect exercise type number -> readable name ("STRENGTH_TRAINING"). */
function exerciseName(type: number): string {
  const entry = Object.entries(hc().ExerciseType).find(([, v]) => v === type);
  return entry ? entry[0].toLowerCase() : `type ${type}`;
}

let initialized = false;

export const health: HealthAdapter = {
  platform: 'ANDROID',

  async availability() {
    if (isExpoGo) return 'needs-build';
    try {
      const H = hc();
      const status = await H.getSdkStatus();
      if (status === H.SdkAvailabilityStatus.SDK_UNAVAILABLE) return 'install-app';
      if (status === H.SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) return 'update-app';
      if (!initialized) initialized = await H.initialize();
      return initialized ? 'ready' : 'unsupported';
    } catch {
      return 'needs-build';
    }
  },

  async requestPermissions() {
    const granted = await hc().requestPermission([
      { accessType: 'read', recordType: 'Steps' },
      { accessType: 'read', recordType: 'ExerciseSession' },
      { accessType: 'read', recordType: 'HeartRate' },
      { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
      { accessType: 'write', recordType: 'ExerciseSession' },
    ]);
    return granted.some((p) => 'accessType' in p && p.accessType === 'read');
  },

  async read(days) {
    const H = hc();
    const samples: HealthSample[] = [];
    // One aggregate per day keeps day boundaries in local time without relying on period slicers.
    for (const start of dayStarts(days)) {
      const end = new Date(Math.min(nextDay(start).getTime(), Date.now()));
      const day = localDay(start);
      const base = { start: start.toISOString(), end: nextDay(start).toISOString() };
      const [steps, energy, heart] = await Promise.all([
        H.aggregateRecord({ recordType: 'Steps', timeRangeFilter: range(start, end) }).catch(() => null),
        H.aggregateRecord({ recordType: 'ActiveCaloriesBurned', timeRangeFilter: range(start, end) }).catch(() => null),
        H.aggregateRecord({ recordType: 'HeartRate', timeRangeFilter: range(start, end) }).catch(() => null),
      ]);
      if (steps && steps.COUNT_TOTAL > 0) {
        samples.push({ kind: 'STEPS', externalId: `STEPS:${day}`, ...base, value: steps.COUNT_TOTAL });
      }
      const kcal = energy?.ACTIVE_CALORIES_TOTAL?.inKilocalories;
      if (kcal && kcal > 0) {
        samples.push({ kind: 'ACTIVE_ENERGY', externalId: `ACTIVE_ENERGY:${day}`, ...base, value: Math.round(kcal) });
      }
      if (heart && heart.MEASUREMENTS_COUNT > 0) {
        samples.push({ kind: 'HEART_RATE', externalId: `HEART_RATE:${day}`, ...base, value: Math.round(heart.BPM_AVG) });
      }
    }

    const from = dayStarts(days)[0];
    const { records } = await H.readRecords('ExerciseSession', { timeRangeFilter: range(from, new Date()) });
    for (const r of records.slice(0, 50)) {
      const start = new Date(r.startTime);
      const end = new Date(r.endTime);
      const [energy, heart] = await Promise.all([
        H.aggregateRecord({ recordType: 'ActiveCaloriesBurned', timeRangeFilter: range(start, end) }).catch(() => null),
        H.aggregateRecord({ recordType: 'HeartRate', timeRangeFilter: range(start, end) }).catch(() => null),
      ]);
      const origin = r.metadata?.dataOrigin;
      samples.push({
        kind: 'WORKOUT',
        externalId: r.metadata?.id ?? `${r.startTime}-${r.exerciseType}`,
        start: start.toISOString(),
        end: end.toISOString(),
        workoutType: exerciseName(r.exerciseType),
        energyKcal: energy?.ACTIVE_CALORIES_TOTAL?.inKilocalories
          ? Math.round(energy.ACTIVE_CALORIES_TOTAL.inKilocalories)
          : undefined,
        avgHr: heart && heart.MEASUREMENTS_COUNT > 0 ? Math.round(heart.BPM_AVG) : undefined,
        sourceName: origin?.slice(0, 80),
        fromDelta: origin === DELTA_PACKAGE || (r.metadata?.clientRecordId ?? '').startsWith(DELTA_MARKER),
      });
    }
    return samples;
  },

  async writeSession(session, title) {
    const H = hc();
    // clientRecordId makes Health Connect update the same record if the session is written again.
    await H.insertRecords([
      {
        recordType: 'ExerciseSession',
        exerciseType: H.ExerciseType.STRENGTH_TRAINING,
        title,
        startTime: session.start,
        endTime: session.end,
        metadata: { clientRecordId: `${DELTA_MARKER}-${session.date}`, clientRecordVersion: Date.now() },
      },
    ]);
  },

  openFix(state) {
    if (state === 'install-app' || state === 'update-app') {
      Linking.openURL(`market://details?id=${HC_PACKAGE}`).catch(() =>
        Linking.openURL(`https://play.google.com/store/apps/details?id=${HC_PACKAGE}`),
      );
    } else {
      hc().openHealthConnectSettings();
    }
  },
};
