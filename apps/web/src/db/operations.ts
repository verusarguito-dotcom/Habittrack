import type {
  Category,
  Habit,
  HabitSchedule,
  HabitLog,
  Setting,
  SyncTable,
  SyncableRecord
} from '@vibehabit/shared';
import { compareLww } from '@vibehabit/shared';
import type { VibeHabitDatabase } from './database.js';
import type { OutboxAction, OutboxItem } from './types.js';

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function enqueueOutbox(
  db: VibeHabitDatabase,
  table: SyncTable,
  recordId: string,
  action: OutboxAction,
  record: SyncableRecord
): Promise<OutboxItem> {
  const item: OutboxItem = {
    id: generateUuid(),
    table,
    record_id: recordId,
    action,
    record,
    predecessor_ids: [],
    created_at: new Date().toISOString()
  };
  await db.outbox.put(item);
  return item;
}

export async function saveCategory(
  db: VibeHabitDatabase,
  category: Category,
  deviceId: string
): Promise<void> {
  const now = new Date().toISOString();
  const entity: Category = {
    ...category,
    updated_at: category.updated_at || now,
    device_id: category.device_id || deviceId
  };
  await db.transaction('rw', [db.categories, db.outbox], async () => {
    await db.categories.put(entity);
    await enqueueOutbox(db, 'categories', entity.id, 'insert', entity);
  });
}

export async function saveHabit(
  db: VibeHabitDatabase,
  habit: Habit,
  deviceId: string
): Promise<void> {
  const now = new Date().toISOString();
  const entity: Habit = {
    ...habit,
    updated_at: habit.updated_at || now,
    device_id: habit.device_id || deviceId
  };
  await db.transaction('rw', [db.habits, db.outbox], async () => {
    await db.habits.put(entity);
    await enqueueOutbox(db, 'habits', entity.id, 'insert', entity);
  });
}

export async function saveHabitSchedule(
  db: VibeHabitDatabase,
  schedule: HabitSchedule,
  deviceId: string
): Promise<void> {
  const now = new Date().toISOString();
  const entity: HabitSchedule = {
    ...schedule,
    updated_at: schedule.updated_at || now,
    device_id: schedule.device_id || deviceId
  };
  await db.transaction('rw', [db.habit_schedules, db.outbox], async () => {
    await db.habit_schedules.put(entity);
    await enqueueOutbox(db, 'habit_schedules', entity.id, 'insert', entity);
  });
}

export async function saveHabitLog(
  db: VibeHabitDatabase,
  log: HabitLog,
  deviceId: string
): Promise<void> {
  const now = new Date().toISOString();
  const entity: HabitLog = {
    ...log,
    updated_at: log.updated_at || now,
    device_id: log.device_id || deviceId
  };

  await db.transaction('rw', [db.logs, db.outbox], async () => {
    // Check uniqueness constraint on [habit_id+tanggal]
    const existing = await db.logs
      .where('[habit_id+tanggal]')
      .equals([entity.habit_id, entity.tanggal])
      .first();

    if (existing) {
      const cmp = compareLww(entity, existing);
      if (cmp <= 0) {
        // Incoming loses to existing record: do not write
        return;
      }
      if (existing.id !== entity.id) {
        // Delete conflicting record with different ID
        await db.logs.delete(existing.id);
      }
    }

    await db.logs.put(entity);
    await enqueueOutbox(db, 'logs', entity.id, 'insert', entity);
  });
}

export async function saveSetting(
  db: VibeHabitDatabase,
  setting: Setting,
  deviceId: string
): Promise<void> {
  const now = new Date().toISOString();
  const entity: Setting = {
    ...setting,
    updated_at: setting.updated_at || now,
    device_id: setting.device_id || deviceId
  };
  await db.transaction('rw', [db.settings, db.outbox], async () => {
    await db.settings.put(entity);
    await enqueueOutbox(db, 'settings', entity.id, 'insert', entity);
  });
}

export async function deleteHabitCascading(
  db: VibeHabitDatabase,
  habitId: string,
  deviceId: string,
  timestamp?: string
): Promise<void> {
  const now = timestamp || new Date().toISOString();

  await db.transaction('rw', [db.habits, db.habit_schedules, db.logs, db.outbox], async () => {
    const habit = await db.habits.get(habitId);
    if (habit && !habit.deleted_at) {
      const deletedHabit: Habit = {
        ...habit,
        deleted_at: now,
        updated_at: now,
        device_id: deviceId
      };
      await db.habits.put(deletedHabit);
      await enqueueOutbox(db, 'habits', habitId, 'delete', deletedHabit);
    }

    const schedules = await db.habit_schedules.where('habit_id').equals(habitId).toArray();
    for (const schedule of schedules) {
      if (!schedule.deleted_at) {
        const deletedSchedule: HabitSchedule = {
          ...schedule,
          deleted_at: now,
          updated_at: now,
          device_id: deviceId
        };
        await db.habit_schedules.put(deletedSchedule);
        await enqueueOutbox(db, 'habit_schedules', schedule.id, 'delete', deletedSchedule);
      }
    }

    const logs = await db.logs.where('habit_id').equals(habitId).toArray();
    for (const log of logs) {
      if (!log.deleted_at) {
        const deletedLog: HabitLog = {
          ...log,
          deleted_at: now,
          updated_at: now,
          device_id: deviceId
        };
        await db.logs.put(deletedLog);
        await enqueueOutbox(db, 'logs', log.id, 'delete', deletedLog);
      }
    }
  });
}

export async function queryLogsByHabitAndDate(
  db: VibeHabitDatabase,
  habitId: string,
  tanggal: string
): Promise<HabitLog | undefined> {
  return await db.logs
    .where('[habit_id+tanggal]')
    .equals([habitId, tanggal])
    .filter((l) => !l.deleted_at)
    .first();
}

export async function queryLogsByDate(
  db: VibeHabitDatabase,
  tanggal: string
): Promise<HabitLog[]> {
  return await db.logs
    .where('tanggal')
    .equals(tanggal)
    .filter((l) => !l.deleted_at)
    .toArray();
}

export async function queryLogsByHabit(
  db: VibeHabitDatabase,
  habitId: string
): Promise<HabitLog[]> {
  return await db.logs
    .where('habit_id')
    .equals(habitId)
    .filter((l) => !l.deleted_at)
    .toArray();
}

export async function queryHabits(
  db: VibeHabitDatabase,
  includeArchived = false
): Promise<Habit[]> {
  return await db.habits
    .filter((h) => !h.deleted_at && (includeArchived || !h.archived))
    .toArray();
}

export async function queryHabitSchedules(
  db: VibeHabitDatabase,
  habitId: string
): Promise<HabitSchedule[]> {
  return await db.habit_schedules
    .where('habit_id')
    .equals(habitId)
    .filter((s) => !s.deleted_at)
    .toArray();
}

export async function queryCategories(
  db: VibeHabitDatabase
): Promise<Category[]> {
  return await db.categories
    .filter((c) => !c.deleted_at)
    .toArray();
}

export async function getSetting(
  db: VibeHabitDatabase
): Promise<Setting | undefined> {
  return await db.settings
    .filter((s) => !s.deleted_at)
    .first();
}
