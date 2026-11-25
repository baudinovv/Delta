import type { HealthAdapter } from './types';

/** Web and other platforms: no on-device health store. */
export const health: HealthAdapter = {
  platform: null,
  availability: async () => 'unsupported',
  requestPermissions: async () => false,
  read: async () => [],
  writeSession: async () => {},
};
