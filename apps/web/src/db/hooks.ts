import { liveQuery, type Observable } from 'dexie';
import type { VibeHabitDatabase } from './database.js';
import type { Habit, HabitLog, HabitSchedule, Category, Setting } from '@vibehabit/shared';
import {
  queryHabits,
  queryLogsByDate,
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

export function observeLogsForDate(
  db: VibeHabitDatabase,
  tanggal: string
): Observable<HabitLog[]> {
  return liveQuery(() => queryLogsByDate(db, tanggal));
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
