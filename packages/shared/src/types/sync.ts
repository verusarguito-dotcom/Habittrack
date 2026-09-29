import type { SyncTable } from './base.js';
import type { Category } from './category.js';
import type { Habit } from './habit.js';
import type { HabitSchedule } from './schedule.js';
import type { HabitLog } from './log.js';
import type { Setting } from './setting.js';

export type SyncableRecord = Category | Habit | HabitSchedule | HabitLog | Setting;

export interface SyncMutation {
  mutation_id: string;
  table: SyncTable;
  record: SyncableRecord;
}

export interface SyncRequest {
  protocol_version: number;
  device_id: string;
  client_time: string; // ISO 8601
  client_last_server_seq: number;
  mutations: SyncMutation[];
}

export interface SyncRejectedItem {
  mutation_id: string;
  reason: string;
}

export interface SyncChange {
  table: SyncTable;
  record: SyncableRecord & { server_seq: number };
}

export interface SyncResponse {
  server_time: string; // ISO 8601
  applied: string[];
  rejected: SyncRejectedItem[];
  changes: SyncChange[];
  new_server_seq: number;
  has_more: boolean;
}
