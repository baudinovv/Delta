import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/** Small key-value store: SecureStore on the phone, localStorage on web (so a reload keeps you signed in). */
export const storage = {
  async get(key: string): Promise<string | null> {
    if (Platform.OS !== 'web') return SecureStore.getItemAsync(key);
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  async set(key: string, value: string): Promise<void> {
    if (Platform.OS !== 'web') return SecureStore.setItemAsync(key, value);
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      // private mode: keep it in memory only
    }
  },
  async remove(key: string): Promise<void> {
    if (Platform.OS !== 'web') return SecureStore.deleteItemAsync(key);
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      // ignore
    }
  },
};
