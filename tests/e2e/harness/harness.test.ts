import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTestHarness,
  createCategory,
  createHabit,
  createHabitSchedule,
  createHabitLog,
  createSetting,
  type TestHarness
} from './index.js';

describe('E2E Test Harness Verification', () => {
  let harness: TestHarness;

  beforeEach(() => {
    harness = createTestHarness();
  });

  it('initializes server and multiple clients with distinct device identities', () => {
    expect(harness.server).toBeDefined();
    expect(harness.clientA.deviceId).toBe('device-test-01');
    expect(harness.clientB.deviceId).toBe('device-test-02');
  });

  it('generates valid domain entities with deterministic IDs', () => {
    const cat = createCategory({ nama: 'Kesehatan' });
    const hab = createHabit({ nama: 'Minum Air', category_id: cat.id });
    const sch = createHabitSchedule({ habit_id: hab.id });
    const log = createHabitLog({ habit_id: hab.id });
    const set = createSetting();

    expect(cat.nama).toBe('Kesehatan');
    expect(hab.category_id).toBe(cat.id);
    expect(sch.habit_id).toBe(hab.id);
    expect(log.habit_id).toBe(hab.id);
    expect(set.jam_mulai_hari).toBe('00:00');
  });

  it('performs basic sync between client and server', async () => {
    const habit = createHabit({ nama: 'Meditasi Pagi', device_id: harness.clientA.deviceId });
    harness.clientA.saveHabit(habit);

    expect(harness.clientA.outbox.length).toBe(1);
    expect(harness.clientA.syncState).toBe('Menunggu sinkron (1)');

    const result = await harness.clientA.sync(harness.server);
    expect(result.success).toBe(true);
    expect(harness.clientA.outbox.length).toBe(0);
    expect(harness.clientA.syncState).toBe('Tersinkron');

    // Server should now contain the habit
    const serverHabit = harness.server.habits.get(habit.id);
    expect(serverHabit).toBeDefined();
    expect(serverHabit?.server_seq).toBeGreaterThan(0);
  });
});
