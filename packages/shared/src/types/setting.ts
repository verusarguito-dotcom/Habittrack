import type { BaseSyncableEntity } from './base.js';

export type AppTheme = 'light' | 'dark' | 'system';

export interface Setting extends BaseSyncableEntity {
  jam_mulai_hari: string; // HH:mm format, e.g. "00:00" or "04:00"
  theme: AppTheme;
  device_token_hash?: string | null;
}
