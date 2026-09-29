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

export interface StreakResult {
  currentStreak: number;
  longestStreak: number;
}

/**
 * Pure calculation for Streak Counter.
 * Follows PRD 7.3 business rules:
 * - Daily habits: consecutive successful scheduled days.
 * - Specific days of week: non-scheduled days skipped without breaking streak.
 * - X times per week: streak counted in weeks (Monday start, minimum X completions).
 * - Current day: uncompleted today does NOT break streak until the day ends.
 * - Schedule versions: dynamic evaluation with effective_from.
 * - Dynamic recalculation: never stored statically, computed from logs.
 */
export function calculateStreak(
  habit: Habit,
  schedules: HabitSchedule[],
  logs: HabitLog[],
  todayStr: string
): StreakResult {
  if (schedules.length === 0 || habit.created_date > todayStr) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  // Fast map of non-deleted logs by date
  const logsByDate = new Map<string, HabitLog>();
  for (const log of logs) {
    if (log.habit_id === habit.id && log.deleted_at === null) {
      logsByDate.set(log.tanggal, log);
    }
  }

  // Determine if this habit uses weekly frequency
  const latestSchedule = getActiveScheduleForDate(schedules, todayStr);
  const isWeekly = latestSchedule?.tipe_frekuensi === 'x_per_week';

  if (isWeekly) {
    return calculateWeeklyStreak(habit, schedules, logsByDate, todayStr);
  }

  return calculateDailyOrSpecificDaysStreak(habit, schedules, logsByDate, todayStr);
}

function calculateWeeklyStreak(
  habit: Habit,
  schedules: HabitSchedule[],
  logsByDate: Map<string, HabitLog>,
  todayStr: string
): StreakResult {
  const startMonday = getStartOfWeek(habit.created_date);
  const currentMonday = getStartOfWeek(todayStr);

  let currentStreak = 0;
  let longestStreak = 0;
  let runningStreak = 0;

  let weekMonday = startMonday;
  while (weekMonday <= currentMonday) {
    const weekSunday = getEndOfWeek(weekMonday);
    const sched =
      getActiveScheduleForDate(schedules, weekMonday) ??
      getActiveScheduleForDate(schedules, weekSunday);
    const targetX = sched?.jumlah_per_minggu ?? 1;

    // Count successful days in this week up to today
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
        // Current week already met target X!
        runningStreak++;
        if (runningStreak > longestStreak) {
          longestStreak = runningStreak;
        }
        currentStreak = runningStreak;
      } else {
        // Current week is still in progress and not finished yet
        // Does not break streak achieved through prior weeks
        currentStreak = runningStreak;
      }
    } else {
      // Past week
      if (weekSuccesses >= targetX) {
        runningStreak++;
        if (runningStreak > longestStreak) {
          longestStreak = runningStreak;
        }
      } else {
        runningStreak = 0;
      }
    }

    weekMonday = addDays(weekMonday, 7);
  }

  return { currentStreak, longestStreak };
}

function calculateDailyOrSpecificDaysStreak(
  habit: Habit,
  schedules: HabitSchedule[],
  logsByDate: Map<string, HabitLog>,
  todayStr: string
): StreakResult {
  const dateRange = generateDateRange(habit.created_date, todayStr);

  let longestStreak = 0;
  let runningStreak = 0;
  let currentStreak = 0;

  for (const date of dateRange) {
    const sched = getActiveScheduleForDate(schedules, date);
    if (!sched) {
      continue;
    }

    // If day is not scheduled, skip without breaking or adding to streak
    if (!isDateScheduled(sched, date)) {
      continue;
    }

    const isToday = date === todayStr;
    const isSuccess = isDaySuccessful(habit, sched, logsByDate.get(date));

    if (isToday) {
      if (isSuccess) {
        runningStreak++;
        if (runningStreak > longestStreak) {
          longestStreak = runningStreak;
        }
        currentStreak = runningStreak;
      } else {
        // Uncompleted today does not break streak achieved up to yesterday
        currentStreak = runningStreak;
      }
    } else {
      // Past scheduled day
      if (isSuccess) {
        runningStreak++;
        if (runningStreak > longestStreak) {
          longestStreak = runningStreak;
        }
      } else {
        // Missed scheduled day breaks the streak
        runningStreak = 0;
      }
      currentStreak = runningStreak;
    }
  }

  return { currentStreak, longestStreak };
}
