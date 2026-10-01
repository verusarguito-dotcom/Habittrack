import type { Category } from './category.js';
import type { Habit } from './habit.js';
import type { HabitSchedule } from './schedule.js';
import type { HabitLog } from './log.js';
import type { Setting } from './setting.js';

export interface BackupData {
  version: number;
  exported_at: string;
  app_version?: string;
  device_id?: string;
  data: {
    categories: Category[];
    habits: Habit[];
    habit_schedules: HabitSchedule[];
    logs: HabitLog[];
    settings?: Setting[];
  };
}
