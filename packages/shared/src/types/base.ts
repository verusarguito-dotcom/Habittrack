export interface BaseSyncableEntity {
  id: string;
  updated_at: string;
  deleted_at: string | null;
  device_id: string;
  server_seq?: number | null;
}

export type SyncTable = 'categories' | 'habits' | 'habit_schedules' | 'logs' | 'settings';
