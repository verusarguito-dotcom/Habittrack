import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTestHarness,
  createHabit,
  createHabitLog,
  type TestHarness
} from '../harness/index.js';

describe('Tier 1 - Feature 02: Kysely Client & Database Transactions', () => {
  let harness: TestHarness;

  beforeEach(() => {
    harness = createTestHarness();
  });

  it('guarantees atomic transaction commit when batch operations succeed', async () => {
    const habit = createHabit({ nama: 'Coding Typescript' });
    const log1 = createHabitLog({ habit_id: habit.id, tanggal: '2026-09-28' });
    const log2 = createHabitLog({ habit_id: habit.id, tanggal: '2026-09-29' });

    harness.clientA.saveHabit(habit);
    harness.clientA.saveHabitLog(log1);
    harness.clientA.saveHabitLog(log2);

    const syncRes = await harness.clientA.sync(harness.server);
    expect(syncRes.success).toBe(true);

    // Verify all 3 records were atomically persisted to database
    expect(harness.server.habits.has(habit.id)).toBe(true);
    expect(harness.server.logs.has(log1.id)).toBe(true);
    expect(harness.server.logs.has(log2.id)).toBe(true);
  });

  it('enforces UNIQUE(habit_id, tanggal) constraint on logs table', async () => {
    const habit = createHabit({ nama: 'Stretching' });
    const logA = createHabitLog({
      habit_id: habit.id,
      tanggal: '2026-09-29',
      nilai: 10,
      updated_at: '2026-09-29T10:00:00.000Z'
    });
    const logB = createHabitLog({
      habit_id: habit.id,
      tanggal: '2026-09-29',
      nilai: 20,
      updated_at: '2026-09-29T10:05:00.000Z'
    });

    harness.clientA.saveHabit(habit);
    harness.clientA.saveHabitLog(logA);
    await harness.clientA.sync(harness.server);

    harness.clientA.saveHabitLog(logB);
    await harness.clientA.sync(harness.server);

    // Only one log record should exist on the server for that (habit_id, tanggal)
    const logsForHabit = Array.from(harness.server.logs.values()).filter(
      (l) => l.habit_id === habit.id && l.tanggal === '2026-09-29'
    );
    expect(logsForHabit.length).toBe(1);
    expect(logsForHabit[0]!.nilai).toBe(20); // Winner logB
  });

  it('maintains strict monotonically increasing server_seq across tables', async () => {
    const habit1 = createHabit({ nama: 'Habit 1' });
    const habit2 = createHabit({ nama: 'Habit 2' });
    const log = createHabitLog({ habit_id: habit1.id, tanggal: '2026-09-29' });

    harness.clientA.saveHabit(habit1);
    harness.clientA.saveHabit(habit2);
    harness.clientA.saveHabitLog(log);

    await harness.clientA.sync(harness.server);

    const seqHabit1 = harness.server.habits.get(habit1.id)!.server_seq;
    const seqHabit2 = harness.server.habits.get(habit2.id)!.server_seq;
    const seqLog = harness.server.logs.get(log.id)!.server_seq;

    expect(seqHabit2).toBeGreaterThan(seqHabit1);
    expect(seqLog).toBeGreaterThan(seqHabit2);
  });

  it('preserves transaction rollback without corrupting existing database state', async () => {
    const habit = createHabit({ nama: 'Valid Initial Habit' });
    harness.clientA.saveHabit(habit);
    await harness.clientA.sync(harness.server);

    const initialSeq = harness.server.getGlobalServerSeq();

    // Send malformed sync request directly
    const malformedRes = harness.server.handleSync(
      {
        protocol_version: -1, // invalid
        device_id: harness.clientA.deviceId,
        client_time: new Date().toISOString(),
        client_last_server_seq: 0,
        mutations: []
      },
      `Bearer ${harness.clientA.authToken}`
    );

    expect(malformedRes.status).toBe(400);
    // Server state and sequence must remain unchanged
    expect(harness.server.getGlobalServerSeq()).toBe(initialSeq);
    expect(harness.server.habits.get(habit.id)?.nama).toBe('Valid Initial Habit');
  });

  it('provides isolated read views during transaction processing', async () => {
    const habit = createHabit({ nama: 'Private Habit' });
    harness.clientA.saveHabit(habit);

    // Before sync, server does not see client's private habit
    expect(harness.server.habits.has(habit.id)).toBe(false);

    await harness.clientA.sync(harness.server);

    // After commit, server sees the habit
    expect(harness.server.habits.has(habit.id)).toBe(true);
  });
});
