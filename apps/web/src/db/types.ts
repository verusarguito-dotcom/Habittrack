import type {
  SyncTable,
  SyncableRecord
} from '@vibehabit/shared';

export type OutboxAction = 'insert' | 'update' | 'delete';

export interface OutboxItem {
  id: string; // UUID
  table: SyncTable;
  record_id: string;
  action: OutboxAction;
  record: SyncableRecord;
  predecessor_ids: string[];
  created_at: string; // ISO 8601
}

export interface StorageEstimate {
  quota: number;
  usage: number;
}
