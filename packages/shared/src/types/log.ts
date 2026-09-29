import type { BaseSyncableEntity } from './base.js';

export interface HabitLog extends BaseSyncableEntity {
  habit_id: string;
  tanggal: string; // YYYY-MM-DD local date
  nilai: number | null; // numeric progress value
  selesai: boolean; // true if target reached or checklist checked
}
