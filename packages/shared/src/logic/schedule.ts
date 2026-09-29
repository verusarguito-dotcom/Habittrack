import type { Habit } from '../types/habit.js';
import type { HabitSchedule } from '../types/schedule.js';
import type { HabitLog } from '../types/log.js';
import { getDayOfWeek } from './date.js';

/**
 * Find active schedule for a habit on a given date (YYYY-MM-DD).
 * Evaluates schedule versions using `effective_from`.
 */
export function getActiveScheduleForDate(
  schedules: HabitSchedule[],
  dateStr: string
): HabitSchedule | null {
  const activeSchedules = schedules
    .filter((s) => !s.deleted_at)
    .sort((a, b) => a.effective_from.localeCompare(b.effective_from));

  if (activeSchedules.length === 0) {
    return null;
  }

  // Find latest schedule where effective_from <= dateStr
  let candidate: HabitSchedule | null = null;
  for (const sched of activeSchedules) {
    if (sched.effective_from <= dateStr) {
      candidate = sched;
    } else {
      break;
    }
  }

  // If date is before earliest schedule's effective_from, fallback to earliest schedule
  return candidate ?? activeSchedules[0] ?? null;
}

/**
 * Check if a date is scheduled according to the schedule rules.
 */
export function isDateScheduled(schedule: HabitSchedule, dateStr: string): boolean {
  if (schedule.tipe_frekuensi === 'daily') {
    return true;
  }

  if (schedule.tipe_frekuensi === 'specific_days') {
    if (!schedule.hari_terjadwal || schedule.hari_terjadwal.length === 0) {
      return false;
    }
    const dow = getDayOfWeek(dateStr); // 1 = Mon .. 7 = Sun
    return schedule.hari_terjadwal.includes(dow);
  }

  if (schedule.tipe_frekuensi === 'x_per_week') {
    return true;
  }

  return false;
}

/**
 * Determine if a habit was successfully completed on a day.
 * PRD 7.2:
 * - Checklist mode: successful if checked (selesai === true).
 * - Quantitative mode: successful if recorded value >= target.
 *   Partial values (nilai < target) are NOT successful.
 */
export function isDaySuccessful(
  habit: Habit,
  schedule: HabitSchedule,
  log?: HabitLog | null
): boolean {
  if (!log || log.deleted_at !== null) {
    return false;
  }

  if (habit.mode === 'checklist') {
    return !!log.selesai;
  }

  if (habit.mode === 'quantitative') {
    const target = schedule.target ?? 1;
    if (log.nilai !== null && log.nilai !== undefined) {
      return log.nilai >= target;
    }
    return false;
  }

  return false;
}
