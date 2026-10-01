import { describe, it, expect } from 'vitest';
import { coalesceOutbox } from '../src/sync/outbox.js';
import type { OutboxItem } from '../src/db/types.js';
import type { Habit } from '@vibehabit/shared';

describe('Outbox Mutation Queue & Batch Coalescing (T010)', () => {
  it('coalesces multiple pending mutations for the same record into a single payload', () => {
    const habitId = '00000000-0000-4000-8000-000000000055';
    const h1: Habit = {
      id: habitId,
      nama: 'Name V1',
      category_id: null,
      mode: 'checklist',
      satuan: null,
      archived: false,
      created_date: '2026-09-01',
      updated_at: '2026-09-29T10:00:00.000Z',
      deleted_at: null,
      device_id: 'dev-1'
    };
    const h2: Habit = {
      ...h1,
      nama: 'Name V2',
      updated_at: '2026-09-29T10:01:00.000Z'
    };
    const h3: Habit = {
      ...h1,
      nama: 'Name V3',
      updated_at: '2026-09-29T10:02:00.000Z'
    };

    const items: OutboxItem[] = [
      {
        id: 'out-1',
        table: 'habits',
        record_id: habitId,
        action: 'insert',
        record: h1,
        predecessor_ids: [],
        created_at: '2026-09-29T10:00:00.000Z'
      },
      {
        id: 'out-2',
        table: 'habits',
        record_id: habitId,
        action: 'update',
        record: h2,
        predecessor_ids: [],
        created_at: '2026-09-29T10:01:00.000Z'
      },
      {
        id: 'out-3',
        table: 'habits',
        record_id: habitId,
        action: 'update',
        record: h3,
        predecessor_ids: [],
        created_at: '2026-09-29T10:02:00.000Z'
      }
    ];

    const { mutations, outboxItemMap } = coalesceOutbox(items);
    expect(mutations.length).toBe(1);
    expect((mutations[0]!.record as Habit).nama).toBe('Name V3');

    const coveredIds = outboxItemMap.get(mutations[0]!.mutation_id);
    expect(coveredIds).toBeDefined();
    expect(coveredIds).toEqual(['out-1', 'out-2', 'out-3']);
  });

  it('tracks predecessor outbox IDs during coalescing', () => {
    const habitId = 'h-pred';
    const items: OutboxItem[] = [
      {
        id: 'out-a',
        table: 'habits',
        record_id: habitId,
        action: 'insert',
        record: { id: habitId } as any,
        predecessor_ids: ['out-prev-1'],
        created_at: '2026-09-29T10:00:00.000Z'
      },
      {
        id: 'out-b',
        table: 'habits',
        record_id: habitId,
        action: 'update',
        record: { id: habitId, nama: 'Updated' } as any,
        predecessor_ids: [],
        created_at: '2026-09-29T10:01:00.000Z'
      }
    ];

    const { mutations, outboxItemMap } = coalesceOutbox(items);
    const covered = outboxItemMap.get(mutations[0]!.mutation_id);
    expect(covered).toContain('out-a');
    expect(covered).toContain('out-b');
    expect(covered).toContain('out-prev-1');
  });

  it('returns empty array when outbox is completely empty', () => {
    const { mutations, outboxItemMap } = coalesceOutbox([]);
    expect(mutations.length).toBe(0);
    expect(outboxItemMap.size).toBe(0);
  });

  it('keeps separate mutations for distinct records across different tables', () => {
    const items: OutboxItem[] = [
      {
        id: 'out-h1',
        table: 'habits',
        record_id: 'h1',
        action: 'insert',
        record: { id: 'h1' } as any,
        predecessor_ids: [],
        created_at: '2026-09-29T10:00:00.000Z'
      },
      {
        id: 'out-l1',
        table: 'logs',
        record_id: 'l1',
        action: 'insert',
        record: { id: 'l1' } as any,
        predecessor_ids: [],
        created_at: '2026-09-29T10:01:00.000Z'
      },
      {
        id: 'out-h2',
        table: 'habits',
        record_id: 'h2',
        action: 'insert',
        record: { id: 'h2' } as any,
        predecessor_ids: [],
        created_at: '2026-09-29T10:02:00.000Z'
      }
    ];

    const { mutations } = coalesceOutbox(items);
    expect(mutations.length).toBe(3);
    const tables = mutations.map((m) => m.table);
    expect(tables).toContain('habits');
    expect(tables).toContain('logs');
  });

  it('guarantees LWW winning mutation is chosen regardless of input array order (e.g. random UUID order)', () => {
    const habitId = 'h-lww-order-test';
    const olderRecord: Habit = {
      id: habitId,
      nama: 'Older Name',
      category_id: null,
      mode: 'checklist',
      satuan: null,
      archived: false,
      created_date: '2026-09-01',
      updated_at: '2026-09-29T10:00:00.000Z',
      deleted_at: null,
      device_id: 'dev-1'
    };
    const newerRecord: Habit = {
      ...olderRecord,
      nama: 'Newer Winning Name',
      updated_at: '2026-09-29T10:05:00.000Z'
    };

    // Simulate items returned by IndexedDB primary key index where older record has a later UUID
    const itemsInReverseOrder: OutboxItem[] = [
      {
        id: '00000000-newer',
        table: 'habits',
        record_id: habitId,
        action: 'update',
        record: newerRecord,
        predecessor_ids: [],
        created_at: '2026-09-29T10:05:00.000Z'
      },
      {
        id: 'zzzzzzzz-older',
        table: 'habits',
        record_id: habitId,
        action: 'insert',
        record: olderRecord,
        predecessor_ids: [],
        created_at: '2026-09-29T10:00:00.000Z'
      }
    ];

    const { mutations } = coalesceOutbox(itemsInReverseOrder);
    expect(mutations.length).toBe(1);
    expect((mutations[0]!.record as Habit).nama).toBe('Newer Winning Name');
  });

  it('coalesces offline edit and cascading delete tombstone into winning delete mutation', () => {
    const habitId = 'h-tomb-coalesce';
    const activeHabit: Habit = {
      id: habitId,
      nama: 'Before Delete',
      category_id: null,
      mode: 'checklist',
      satuan: null,
      archived: false,
      created_date: '2026-09-01',
      updated_at: '2026-09-29T10:00:00.000Z',
      deleted_at: null,
      device_id: 'dev-1'
    };
    const tombstoneHabit: Habit = {
      ...activeHabit,
      updated_at: '2026-09-29T10:10:00.000Z',
      deleted_at: '2026-09-29T10:10:00.000Z'
    };

    // Even if active mutation is placed last in array
    const items: OutboxItem[] = [
      {
        id: '1-tombstone',
        table: 'habits',
        record_id: habitId,
        action: 'delete',
        record: tombstoneHabit,
        predecessor_ids: [],
        created_at: '2026-09-29T10:10:00.000Z'
      },
      {
        id: '2-active',
        table: 'habits',
        record_id: habitId,
        action: 'insert',
        record: activeHabit,
        predecessor_ids: [],
        created_at: '2026-09-29T10:00:00.000Z'
      }
    ];

    const { mutations } = coalesceOutbox(items);
    expect(mutations.length).toBe(1);
    expect((mutations[0]!.record as Habit).deleted_at).toBe('2026-09-29T10:10:00.000Z');
  });
});
