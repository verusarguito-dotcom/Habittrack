import type { BaseSyncableEntity } from './base.js';

export type HabitMode = 'checklist' | 'quantitative';

export interface Habit extends BaseSyncableEntity {
  nama: string;
  category_id: string | null;
  mode: HabitMode;
  satuan: string | null;
  archived: boolean;
  created_date: string; // YYYY-MM-DD local date
}
