import { api } from '@/lib/api';
import { storage } from '@/lib/storage';

import { health } from './health';
import { localDay, type HealthAvailability } from './types';

const CONNECTED_KEY = 'delta.health.connected';
const EXPORTED_KEY = 'delta.health.exported';
const LAST_SYNC_KEY = 'delta.health.lastSync';
const AUTO_SYNC_EVERY_MS = 30 * 60 * 1000;

export { health };

/** This device has granted access and the user turned sync on. */
export const isConnected = async () => (await storage.get(CONNECTED_KEY)) === '1';
export const setConnected = (on: boolean) => (on ? storage.set(CONNECTED_KEY, '1') : storage.remove(CONNECTED_KEY));

async function exportedDates(): Promise<Set<string>> {
  try {
    return new Set(JSON.parse((await storage.get(EXPORTED_KEY)) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

export type SyncResult = { read: number; exported: number };

/**
 * Reads the last 7 days from Apple Health / Health Connect and uploads them, then writes finished Delta
 * strength sessions back as workouts. Today's session is written only when `includeToday` is set,
 * because it may still grow.
 */
export async function syncNow(token: string, titleFor: (exercises: string[]) => string, includeToday = false): Promise<SyncResult> {
  if (!health.platform) return { read: 0, exported: 0 };
  const samples = await health.read(7);
  for (let i = 0; i < samples.length; i += 500) {
    await api.healthSync(token, health.platform, samples.slice(i, i + 500));
  }
  if (samples.length === 0) await api.healthSync(token, health.platform, []);

  const today = localDay(new Date());
  const done = await exportedDates();
  let exported = 0;
  for (const s of await api.healthSessions(token, 14)) {
    const isToday = s.date === today;
    if ((isToday && !includeToday) || (!isToday && done.has(s.date))) continue;
    await health.writeSession(s, titleFor(s.exercises));
    if (!isToday) done.add(s.date);
    exported++;
  }
  await storage.set(EXPORTED_KEY, JSON.stringify([...done].slice(-60)));
  await storage.set(LAST_SYNC_KEY, String(Date.now()));
  return { read: samples.length, exported };
}

/** Quiet background sync when the app opens: only if connected, ready, and not synced recently. */
export async function autoSync(token: string, titleFor: (exercises: string[]) => string) {
  try {
    if (!(await isConnected())) return;
    const last = Number((await storage.get(LAST_SYNC_KEY)) ?? 0);
    if (Date.now() - last < AUTO_SYNC_EVERY_MS) return;
    if ((await health.availability()) !== 'ready') return;
    await syncNow(token, titleFor);
  } catch {
    // background: the health screen shows errors when the user syncs by hand
  }
}

export type { HealthAvailability };
