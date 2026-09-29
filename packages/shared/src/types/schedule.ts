import type { BaseSyncableEntity } from './base.js';

export type FrequencyType = 'daily' | 'specific_days' | 'x_per_week';

export interface HabitSchedule extends BaseSyncableEntity {
  habit_id: string;
  tipe_frekuensi: FrequencyType;
  hari_terjadwal: number[] | null; // 1 = Monday, ..., 7 = Sunday
  jumlah_per_minggu: number | null; // e.g. 3
  target: number | null; // quantitative target or 1 for checklist
  effective_from: string; // YYYY-MM-DD local date
}
