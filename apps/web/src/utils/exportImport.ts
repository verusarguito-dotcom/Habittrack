import type {
  BackupData,
  Habit
} from '@vibehabit/shared';
import { backupDataSchema, compareLww } from '@vibehabit/shared';
import type { VibeHabitDatabase } from '../db/database.js';
import { enqueueOutbox } from '../db/operations.js';

export interface ImportPreviewStats {
  categoryCount: number;
  habitCount: number;
  scheduleCount: number;
  logCount: number;
  exportedAt: string;
  sourceDeviceId?: string;
  version: number;
}

export interface ValidationResult {
  valid: boolean;
  data?: BackupData;
  error?: string;
  stats?: ImportPreviewStats;
}

export interface ImportResult {
  success: boolean;
  mode: 'merge' | 'clean_restore';
  stats: {
    categories: number;
    habits: number;
    schedules: number;
    logs: number;
  };
}

export const LAST_BACKUP_KEY = 'vibehabit_last_backup_at';
export const LAST_SYNC_KEY = 'vibehabit_last_sync_at';
export const DEVICE_TOKEN_KEY = 'vibehabit_device_token';

/**
 * Creates a complete JSON snapshot of all database tables.
 */
export async function exportDatabaseToJson(
  db: VibeHabitDatabase,
  deviceId: string
): Promise<BackupData> {
  const [categories, habits, habitSchedules, logs, settings] = await Promise.all([
    db.categories.toArray(),
    db.habits.toArray(),
    db.habit_schedules.toArray(),
    db.logs.toArray(),
    db.settings.toArray()
  ]);

  const now = new Date().toISOString();
  const backup: BackupData = {
    version: 1,
    exported_at: now,
    app_version: '0.1.0',
    device_id: deviceId,
    data: {
      categories,
      habits,
      habit_schedules: habitSchedules,
      logs,
      settings
    }
  };

  // Record export timestamp
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LAST_BACKUP_KEY, now);
    }
  } catch (err) {
    console.warn('Failed to save last backup timestamp to localStorage:', err);
  }

  return backup;
}

/**
 * Triggers browser download of a JSON snapshot.
 */
export function triggerJsonDownload(data: unknown, filename: string): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return;
  }
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export habit logs and metadata to a CSV formatted string for external spreadsheet analysis.
 */
export async function exportHabitsToCsv(db: VibeHabitDatabase): Promise<string> {
  const [categories, habits, logs] = await Promise.all([
    db.categories.toArray(),
    db.habits.toArray(),
    db.logs.toArray()
  ]);

  const catMap = new Map<string, string>();
  for (const c of categories) {
    catMap.set(c.id, c.nama);
  }

  const habitMap = new Map<string, Habit>();
  for (const h of habits) {
    habitMap.set(h.id, h);
  }

  const rows: string[] = ['Habit,Kategori,Mode,Tanggal,Nilai,Satuan,Selesai'];

  for (const log of logs) {
    if (log.deleted_at) continue;
    const habit = habitMap.get(log.habit_id);
    const habitName = habit ? `"${habit.nama.replace(/"/g, '""')}"` : 'Unknown';
    const catName = habit?.category_id && catMap.has(habit.category_id)
      ? `"${catMap.get(habit.category_id)!.replace(/"/g, '""')}"`
      : 'Tanpa Kategori';
    const mode = habit?.mode || 'checklist';
    const satuan = habit?.satuan ? `"${habit.satuan.replace(/"/g, '""')}"` : '';
    const nilai = log.nilai !== null && log.nilai !== undefined ? log.nilai : '';
    const selesai = log.selesai ? '1' : '0';

    rows.push(`${habitName},${catName},${mode},${log.tanggal},${nilai},${satuan},${selesai}`);
  }

  return rows.join('\n');
}

/**
 * Validates a parsed JSON payload or string against the official backupDataSchema.
 */
export function validateBackupJson(raw: unknown): ValidationResult {
  try {
    let parsedObject = raw;
    if (typeof raw === 'string') {
      parsedObject = JSON.parse(raw);
    }

    const parseResult = backupDataSchema.safeParse(parsedObject);
    if (!parseResult.success) {
      const errorMsg = parseResult.error.issues
        .map((issue: { path: (string | number)[]; message: string }) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ');
      return {
        valid: false,
        error: `Format berkas cadangan tidak valid: ${errorMsg}`
      };
    }

    const data = parseResult.data as BackupData;
    const stats: ImportPreviewStats = {
      categoryCount: data.data.categories.length,
      habitCount: data.data.habits.length,
      scheduleCount: data.data.habit_schedules.length,
      logCount: data.data.logs.length,
      exportedAt: data.exported_at,
      sourceDeviceId: data.device_id,
      version: data.version
    };

    return {
      valid: true,
      data,
      stats
    };
  } catch (err) {
    return {
      valid: false,
      error: `Gagal membaca berkas JSON: ${err instanceof Error ? err.message : String(err)}`
    };
  }
}

/**
 * Imports a validated BackupData snapshot into Dexie IndexedDB.
 * Supports:
 * - 'merge': Safe Last-Write-Wins comparison against existing records. Local newer data won't be overwritten.
 * - 'clean_restore': Clears all database tables and outbox, then inserts entire snapshot.
 *
 * Both modes enlist imported mutations into the outbox so changes synchronize with VPS.
 */
export async function importBackupData(
  db: VibeHabitDatabase,
  backup: BackupData,
  mode: 'merge' | 'clean_restore',
  _deviceId: string
): Promise<ImportResult> {
  const { categories, habits, habit_schedules, logs, settings } = backup.data;

  const appliedStats = {
    categories: 0,
    habits: 0,
    schedules: 0,
    logs: 0
  };

  await db.transaction(
    'rw',
    [db.categories, db.habits, db.habit_schedules, db.logs, db.settings, db.outbox],
    async () => {
      if (mode === 'clean_restore') {
        // Clear all tables
        await Promise.all([
          db.categories.clear(),
          db.habits.clear(),
          db.habit_schedules.clear(),
          db.logs.clear(),
          db.settings.clear(),
          db.outbox.clear()
        ]);

        // Bulk insert records
        if (categories.length > 0) {
          await db.categories.bulkPut(categories);
          for (const c of categories) {
            await enqueueOutbox(db, 'categories', c.id, c.deleted_at ? 'delete' : 'insert', c);
          }
          appliedStats.categories = categories.length;
        }

        if (habits.length > 0) {
          await db.habits.bulkPut(habits);
          for (const h of habits) {
            await enqueueOutbox(db, 'habits', h.id, h.deleted_at ? 'delete' : 'insert', h);
          }
          appliedStats.habits = habits.length;
        }

        if (habit_schedules.length > 0) {
          await db.habit_schedules.bulkPut(habit_schedules);
          for (const s of habit_schedules) {
            await enqueueOutbox(db, 'habit_schedules', s.id, s.deleted_at ? 'delete' : 'insert', s);
          }
          appliedStats.schedules = habit_schedules.length;
        }

        if (logs.length > 0) {
          await db.logs.bulkPut(logs);
          for (const l of logs) {
            await enqueueOutbox(db, 'logs', l.id, l.deleted_at ? 'delete' : 'insert', l);
          }
          appliedStats.logs = logs.length;
        }

        if (settings && settings.length > 0) {
          await db.settings.bulkPut(settings);
          for (const s of settings) {
            await enqueueOutbox(db, 'settings', s.id, s.deleted_at ? 'delete' : 'insert', s);
          }
        }
      } else {
        // Mode 'merge': Safe Last-Write-Wins (LWW)
        // 1. Categories
        for (const incoming of categories) {
          const existing = await db.categories.get(incoming.id);
          if (!existing || compareLww(incoming, existing) > 0) {
            await db.categories.put(incoming);
            const action = incoming.deleted_at ? 'delete' : existing ? 'update' : 'insert';
            await enqueueOutbox(db, 'categories', incoming.id, action, incoming);
            appliedStats.categories++;
          }
        }

        // 2. Habits
        for (const incoming of habits) {
          const existing = await db.habits.get(incoming.id);
          if (!existing || compareLww(incoming, existing) > 0) {
            await db.habits.put(incoming);
            const action = incoming.deleted_at ? 'delete' : existing ? 'update' : 'insert';
            await enqueueOutbox(db, 'habits', incoming.id, action, incoming);
            appliedStats.habits++;
          }
        }

        // 3. Habit Schedules
        for (const incoming of habit_schedules) {
          const existing = await db.habit_schedules.get(incoming.id);
          if (!existing || compareLww(incoming, existing) > 0) {
            await db.habit_schedules.put(incoming);
            const action = incoming.deleted_at ? 'delete' : existing ? 'update' : 'insert';
            await enqueueOutbox(db, 'habit_schedules', incoming.id, action, incoming);
            appliedStats.schedules++;
          }
        }

        // 4. Logs
        for (const incoming of logs) {
          const existing = await db.logs.get(incoming.id);
          if (!existing || compareLww(incoming, existing) > 0) {
            await db.logs.put(incoming);
            const action = incoming.deleted_at ? 'delete' : existing ? 'update' : 'insert';
            await enqueueOutbox(db, 'logs', incoming.id, action, incoming);
            appliedStats.logs++;
          }
        }

        // 5. Settings
        if (settings && settings.length > 0) {
          for (const incoming of settings) {
            const existing = await db.settings.get(incoming.id);
            if (!existing || compareLww(incoming, existing) > 0) {
              await db.settings.put(incoming);
              const action = incoming.deleted_at ? 'delete' : existing ? 'update' : 'insert';
              await enqueueOutbox(db, 'settings', incoming.id, action, incoming);
            }
          }
        }
      }
    }
  );

  // Update last backup timestamp
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString());
    }
  } catch (err) {
    console.warn('Failed to update last backup timestamp after import:', err);
  }

  return {
    success: true,
    mode,
    stats: appliedStats
  };
}
