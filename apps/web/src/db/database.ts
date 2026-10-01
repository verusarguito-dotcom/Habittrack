import { Dexie, type EntityTable, type DexieOptions } from 'dexie';
import type {
  Category,
  Habit,
  HabitSchedule,
  HabitLog,
  Setting
} from '@vibehabit/shared';
import type { OutboxItem } from './types.js';

export class VibeHabitDatabase extends Dexie {
  categories!: EntityTable<Category, 'id'>;
  habits!: EntityTable<Habit, 'id'>;
  habit_schedules!: EntityTable<HabitSchedule, 'id'>;
  logs!: EntityTable<HabitLog, 'id'>;
  settings!: EntityTable<Setting, 'id'>;
  outbox!: EntityTable<OutboxItem, 'id'>;

  constructor(dbName = 'vibehabit_db', options?: DexieOptions) {
    super(dbName, options);

    this.version(1).stores({
      categories: 'id, updated_at, server_seq',
      habits: 'id, category_id, archived, updated_at, server_seq',
      habit_schedules: 'id, habit_id, effective_from, updated_at, server_seq',
      logs: 'id, habit_id, tanggal, [habit_id+tanggal], server_seq, updated_at',
      settings: 'id, updated_at',
      outbox: 'id, table, record_id, [table+record_id], created_at'
    });
  }
}

export function createDatabase(dbName = 'vibehabit_db', options?: DexieOptions): VibeHabitDatabase {
  return new VibeHabitDatabase(dbName, options);
}
