import type { SyncMutation } from '@vibehabit/shared';
import { compareLww, doesIncomingWinLww } from '@vibehabit/shared';
import type { OutboxItem } from '../db/types.js';

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

/**
 * Coalesces pending outbox mutations per entity record.
 * Multiple offline edits/tombstones to the same record coalesce into a single winning mutation
 * determined via LWW with predecessor ID tracking for atomic confirmation cleanup.
 */
export function coalesceOutbox(outboxItems: OutboxItem[]): {
  mutations: SyncMutation[];
  outboxItemMap: Map<string, string[]>;
} {
  const grouped = new Map<string, OutboxItem[]>();

  for (const item of outboxItems) {
    const key = `${item.table}:${item.record_id}`;
    let list = grouped.get(key);
    if (!list) {
      list = [];
      grouped.set(key, list);
    }
    list.push(item);
  }

  const mutations: SyncMutation[] = [];
  const outboxItemMap = new Map<string, string[]>();

  for (const [, items] of grouped.entries()) {
    let latestItem = items[0]!;
    for (let i = 1; i < items.length; i++) {
      const candidate = items[i]!;
      if (doesIncomingWinLww(candidate.record, latestItem.record)) {
        latestItem = candidate;
      } else if (compareLww(candidate.record, latestItem.record) === 0) {
        if (candidate.created_at >= latestItem.created_at) {
          latestItem = candidate;
        }
      }
    }

    const mutationId = generateUuid();
    const allOutboxIds = Array.from(new Set(items.flatMap((i) => [i.id, ...i.predecessor_ids])));

    mutations.push({
      mutation_id: mutationId,
      table: latestItem.table,
      record: latestItem.record
    });

    outboxItemMap.set(mutationId, allOutboxIds);
  }

  return { mutations, outboxItemMap };
}
