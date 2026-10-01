import { liveQuery, type Observable } from 'dexie';
import type { VibeHabitDatabase } from './database.js';
import type { Habit, HabitLog, HabitSchedule, Category, Setting } from '@vibehabit/shared';
import {
  queryHabits,
  getHabit,
  queryLogsByDate,
  queryLogsByDateRange,
  queryLogsByHabitAndDate,
  queryHabitSchedules,
  queryCategories,
  getSetting
} from './operations.js';

export function observeHabits(
  db: VibeHabitDatabase,
  includeArchived = false
): Observable<Habit[]> {
  return liveQuery(() => queryHabits(db, includeArchived));
}

export function observeHabit(
  db: VibeHabitDatabase,
  habitId: string
): Observable<Habit | undefined> {
  return liveQuery(() => getHabit(db, habitId));
}

export function observeLogsForDate(
  db: VibeHabitDatabase,
  tanggal: string
): Observable<HabitLog[]> {
  return liveQuery(() => queryLogsByDate(db, tanggal));
}

export function observeLogsForDateRange(
  db: VibeHabitDatabase,
  startDate: string,
  endDate: string
): Observable<HabitLog[]> {
  return liveQuery(() => queryLogsByDateRange(db, startDate, endDate));
}

export function observeLogsForHabitAndDate(
  db: VibeHabitDatabase,
  habitId: string,
  tanggal: string
): Observable<HabitLog | undefined> {
  return liveQuery(() => queryLogsByHabitAndDate(db, habitId, tanggal));
}

export function observeHabitSchedules(
  db: VibeHabitDatabase,
  habitId: string
): Observable<HabitSchedule[]> {
  return liveQuery(() => queryHabitSchedules(db, habitId));
}

export function observeCategories(
  db: VibeHabitDatabase
): Observable<Category[]> {
  return liveQuery(() => queryCategories(db));
}

export function observeSetting(
  db: VibeHabitDatabase
): Observable<Setting | undefined> {
  return liveQuery(() => getSetting(db));
}

export function observeOutboxCount(
  db: VibeHabitDatabase
): Observable<number> {
  return liveQuery(() => db.outbox.count());
}
