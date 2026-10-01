import type { Generated, ColumnType, Selectable, Insertable, Updateable } from 'kysely';
import type {
  Category,
  Habit,
  HabitSchedule,
  HabitLog,
  Setting,
  HabitMode,
  FrequencyType,
  AppTheme
} from '@vibehabit/shared';

export type { Category, Habit, HabitSchedule, HabitLog, Setting };

export interface CategoryTable {
  id: string;
  nama: string;
  updated_at: ColumnType<string, string | Date, string | Date>;
  deleted_at: ColumnType<string | null, string | Date | null, string | Date | null>;
  device_id: string;
  server_seq: Generated<number>;
}

export type CategoryRow = Selectable<CategoryTable>;
export type NewCategory = Insertable<CategoryTable>;
export type CategoryUpdate = Updateable<CategoryTable>;

export interface HabitTable {
  id: string;
  nama: string;
  category_id: string | null;
  mode: HabitMode;
  satuan: string | null;
  archived: ColumnType<boolean, boolean | undefined, boolean>;
  created_date: string;
  updated_at: ColumnType<string, string | Date, string | Date>;
  deleted_at: ColumnType<string | null, string | Date | null, string | Date | null>;
  device_id: string;
  server_seq: Generated<number>;
}

export type HabitRow = Selectable<HabitTable>;
export type NewHabit = Insertable<HabitTable>;
export type HabitUpdate = Updateable<HabitTable>;

export interface HabitScheduleTable {
  id: string;
  habit_id: string;
  tipe_frekuensi: FrequencyType;
  hari_terjadwal: ColumnType<number[] | null, string | number[] | null, string | number[] | null>;
  jumlah_per_minggu: number | null;
  target: number | null;
  effective_from: string;
  updated_at: ColumnType<string, string | Date, string | Date>;
  deleted_at: ColumnType<string | null, string | Date | null, string | Date | null>;
  device_id: string;
  server_seq: Generated<number>;
}

export type HabitScheduleRow = Selectable<HabitScheduleTable>;
export type NewHabitSchedule = Insertable<HabitScheduleTable>;
export type HabitScheduleUpdate = Updateable<HabitScheduleTable>;

export interface HabitLogTable {
  id: string;
  habit_id: string;
  tanggal: string;
  nilai: number | null;
  selesai: ColumnType<boolean, boolean | undefined, boolean>;
  updated_at: ColumnType<string, string | Date, string | Date>;
  deleted_at: ColumnType<string | null, string | Date | null, string | Date | null>;
  device_id: string;
  server_seq: Generated<number>;
}

export type HabitLogRow = Selectable<HabitLogTable>;
export type NewHabitLog = Insertable<HabitLogTable>;
export type HabitLogUpdate = Updateable<HabitLogTable>;

export interface SettingTable {
  id: string;
  jam_mulai_hari: ColumnType<string, string | undefined, string>;
  theme: ColumnType<AppTheme, AppTheme | undefined, AppTheme>;
  device_token_hash: string | null;
  updated_at: ColumnType<string, string | Date, string | Date>;
  deleted_at: ColumnType<string | null, string | Date | null, string | Date | null>;
  device_id: string;
  server_seq: Generated<number>;
}

export type SettingRow = Selectable<SettingTable>;
export type NewSetting = Insertable<SettingTable>;
export type SettingUpdate = Updateable<SettingTable>;

export interface Database {
  categories: CategoryTable;
  habits: HabitTable;
  habit_schedules: HabitScheduleTable;
  logs: HabitLogTable;
  settings: SettingTable;
}
