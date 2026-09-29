import type { Habit } from '../types/habit.js';
import type { HabitSchedule } from '../types/schedule.js';
import type { HabitLog } from '../types/log.js';
import {
  addDays,
  getStartOfWeek,
  getEndOfWeek,
  generateDateRange
} from './date.js';
import {
  getActiveScheduleForDate,
  isDateScheduled,
  isDaySuccessful
} from './schedule.js';

export interface SuccessRatioResult {
  successfulDays: number;
  scheduledDays: number;
  ratio: number; // 0.0 to 1.0
}

/**
 * Pure calculation for Success Ratio.
 * Follows PRD 7.4 business rules:
 * - Ratio = successful scheduled days / total scheduled days.
 * - Measured from habit.created_date to today.
 * - Today is only counted in the denominator if already completed or day has ended.
 * - Non-scheduled days are excluded from the denominator.
 */
export function calculateSuccessRatio(
  habit: Habit,
  schedules: HabitSchedule[],
  logs: HabitLog[],
  todayStr: string
): SuccessRatioResult {
  if (schedules.length === 0 || habit.created_date > todayStr) {
    return { successfulDays: 0, scheduledDays: 0, ratio: 0.0 };
  }

  const logsByDate = new Map<string, HabitLog>();
  for (const log of logs) {
    if (log.habit_id === habit.id && log.deleted_at === null) {
      logsByDate.set(log.tanggal, log);
    }
  }

  const latestSchedule = getActiveScheduleForDate(schedules, todayStr);
  const isWeekly = latestSchedule?.tipe_frekuensi === 'x_per_week';

  if (isWeekly) {
    return calculateWeeklyRatio(habit, schedules, logsByDate, todayStr);
  }

  return calculateDailyOrSpecificDaysRatio(habit, schedules, logsByDate, todayStr);
}

function calculateWeeklyRatio(
  habit: Habit,
  schedules: HabitSchedule[],
  logsByDate: Map<string, HabitLog>,
  todayStr: string
): SuccessRatioResult {
  const startMonday = getStartOfWeek(habit.created_date);
  const currentMonday = getStartOfWeek(todayStr);

  let scheduledDays = 0;
  let successfulDays = 0;

  let weekMonday = startMonday;
  while (weekMonday <= currentMonday) {
    const weekSunday = getEndOfWeek(weekMonday);
    const sched =
      getActiveScheduleForDate(schedules, weekMonday) ??
      getActiveScheduleForDate(schedules, weekSunday);
    const targetX = sched?.jumlah_per_minggu ?? 1;

    let weekSuccesses = 0;
    let day = weekMonday;
    while (day <= weekSunday && day <= todayStr) {
      if (sched && isDaySuccessful(habit, sched, logsByDate.get(day))) {
        weekSuccesses++;
      }
      day = addDays(day, 1);
    }

    const isCurrentWeek = weekMonday === currentMonday;

    if (isCurrentWeek) {
      if (weekSuccesses >= targetX) {
        scheduledDays += targetX;
        successfulDays += targetX;
      } else {
        // In-progress week: count completed days so far
        if (weekSuccesses > 0) {
          scheduledDays += weekSuccesses;
          successfulDays += weekSuccesses;
        }
      }
    } else {
      scheduledDays += targetX;
      successfulDays += Math.min(weekSuccesses, targetX);
    }

    weekMonday = addDays(weekMonday, 7);
  }

  const ratio = scheduledDays > 0 ? successfulDays / scheduledDays : 0.0;
  return { successfulDays, scheduledDays, ratio };
}

function calculateDailyOrSpecificDaysRatio(
  habit: Habit,
  schedules: HabitSchedule[],
  logsByDate: Map<string, HabitLog>,
  todayStr: string
): SuccessRatioResult {
  const dateRange = generateDateRange(habit.created_date, todayStr);

  let scheduledDays = 0;
  let successfulDays = 0;

  for (const date of dateRange) {
    const sched = getActiveScheduleForDate(schedules, date);
    if (!sched) {
      continue;
    }

    // Exclude non-scheduled days from denominator
    if (!isDateScheduled(sched, date)) {
      continue;
    }

    const isToday = date === todayStr;
    const isSuccess = isDaySuccessful(habit, sched, logsByDate.get(date));

    if (isToday) {
      // PRD 7.4: Today is only counted if already completed
      if (isSuccess) {
        scheduledDays++;
        successfulDays++;
      }
    } else {
      // Past scheduled day: always in denominator
      scheduledDays++;
      if (isSuccess) {
        successfulDays++;
      }
    }
  }

  const ratio = scheduledDays > 0 ? successfulDays / scheduledDays : 0.0;
  return { successfulDays, scheduledDays, ratio };
}
