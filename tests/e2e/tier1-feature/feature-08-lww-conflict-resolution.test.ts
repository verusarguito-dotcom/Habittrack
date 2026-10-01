import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTestHarness,
  createHabit,
  createMutation,
  createSyncRequest,
  type TestHarness
} from '../harness/index.js';

describe('Tier 1 - Feature 08: LWW Conflict Resolution & Monotonic Seq', () => {
  let harness: TestHarness;

  beforeEach(() => {
    harness = createTestHarness();
  });

  it('resolves conflict in favor of later updated_at timestamp', async () => {
    const habitId = '00000000-0000-4000-8000-000000000099';
    const habitV1 = createHabit({
      id: habitId,
      nama: 'Version 1 Early',
      updated_at: '2026-09-29T10:00:00.000Z',
      device_id: 'device-test-01'
    });
    const habitV2 = createHabit({
      id: habitId,
      nama: 'Version 2 Later',
      updated_at: '2026-09-29T10:05:00.000Z',
      device_id: 'device-test-02'
    });

    // Device A applies V1
    harness.clientA.saveHabit(habitV1);
    await harness.clientA.sync(harness.server);
    expect(harness.server.habits.get(habitId)?.nama).toBe('Version 1 Early');

    // Device B applies V2 (later timestamp)
    harness.clientB.saveHabit(habitV2);
    await harness.clientB.sync(harness.server);
    expect(harness.server.habits.get(habitId)?.nama).toBe('Version 2 Later');
  });

  it('tie-breaks identical timestamps using lexicographical device_id comparison', async () => {
    const habitId = '00000000-0000-4000-8000-000000000098';
    const sameTimestamp = '2026-09-29T12:00:00.000Z';

    const habitFromDevice01 = createHabit({
      id: habitId,
      nama: 'From Device 01',
      updated_at: sameTimestamp,
      device_id: 'device-01'
    });
    const habitFromDevice02 = createHabit({
      id: habitId,
      nama: 'From Device 02',
      updated_at: sameTimestamp,
      device_id: 'device-02' // 'device-02' > 'device-01'
    });

    // Send device 01 mutation
    const mut1 = createMutation('habits', habitFromDevice01, 'm1');
    const req1 = createSyncRequest([mut1], { device_id: 'device-01' });
    harness.server.handleSync(req1, `Bearer ${harness.clientA.authToken}`);

    // Send device 02 mutation with identical timestamp
    const mut2 = createMutation('habits', habitFromDevice02, 'm2');
    const req2 = createSyncRequest([mut2], { device_id: 'device-02' });
    harness.server.handleSync(req2, `Bearer ${harness.clientB.authToken}`);

    // Device 02 must win the tie-break
    expect(harness.server.habits.get(habitId)?.nama).toBe('From Device 02');
    expect(harness.server.habits.get(habitId)?.device_id).toBe('device-02');
  });

  it('discards losing mutation on server while returning it in applied to clear client outbox', async () => {
    const habitId = '00000000-0000-4000-8000-000000000097';
    const serverHabit = createHabit({
      id: habitId,
      nama: 'Newer Server Record',
      updated_at: '2026-09-29T14:00:00.000Z',
      device_id: 'device-test-01'
    });
    harness.clientA.saveHabit(serverHabit);
    await harness.clientA.sync(harness.server);

    const initialSeq = harness.server.getGlobalServerSeq();

    // Client B sends older mutation
    const olderHabit = createHabit({
      id: habitId,
      nama: 'Older Stale Record',
      updated_at: '2026-09-29T13:00:00.000Z',
      device_id: 'device-test-02'
    });
    harness.clientB.saveHabit(olderHabit);
    const syncRes = await harness.clientB.sync(harness.server);

    expect(syncRes.success).toBe(true);
    // Client B outbox should be cleared because mutation was confirmed in applied
    expect(harness.clientB.outbox.length).toBe(0);
    // Server must still hold the newer record
    expect(harness.server.habits.get(habitId)?.nama).toBe('Newer Server Record');
    // Global sequence must not advance for losing mutation
    expect(harness.server.getGlobalServerSeq()).toBe(initialSeq);
  });

  it('increments global server_seq only when mutation strictly wins', async () => {
    const habit = createHabit({ nama: 'Winning Habit 1' });
    harness.clientA.saveHabit(habit);

    const seqBefore = harness.server.getGlobalServerSeq();
    await harness.clientA.sync(harness.server);
    const seqAfter = harness.server.getGlobalServerSeq();

    expect(seqAfter).toBe(seqBefore + 1);
  });

  it('propagates winning server records to local client database on pull merge', async () => {
    const habit = createHabit({
      nama: 'Propagated Habit',
      device_id: harness.clientA.deviceId
    });
    harness.clientA.saveHabit(habit);
    await harness.clientA.sync(harness.server);

    // Client B syncs and should receive the winning record
    await harness.clientB.sync(harness.server);
    expect(harness.clientB.habits.get(habit.id)?.nama).toBe('Propagated Habit');
  });
});
