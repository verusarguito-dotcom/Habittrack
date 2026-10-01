import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTestHarness,
  createHabit,
  createSyncRequest,
  type TestHarness
} from '../harness/index.js';

describe('Tier 1 - Feature 10: Pull Query Cursor Pagination (500 row limit)', () => {
  let harness: TestHarness;

  beforeEach(() => {
    harness = createTestHarness();
  });

  it('pulls records where server_seq > client_last_server_seq', () => {
    // Populate server with 3 habits directly
    const h1 = createHabit({ nama: 'Pull H1' });
    const h2 = createHabit({ nama: 'Pull H2' });
    const h3 = createHabit({ nama: 'Pull H3' });

    harness.clientA.saveHabit(h1);
    harness.clientA.saveHabit(h2);
    harness.clientA.saveHabit(h3);

    return harness.clientA.sync(harness.server).then(() => {
      const seqH2 = harness.server.habits.get(h2.id)!.server_seq;

      // Query from client B starting at seqH2
      const req = createSyncRequest([], { client_last_server_seq: seqH2 });
      const res = harness.server.handleSync(req, `Bearer ${harness.clientB.authToken}`);

      expect(res.status).toBe(200);
      const changes = (res.body as any).changes;
      expect(changes.length).toBe(1);
      expect(changes[0].record.id).toBe(h3.id);
    });
  });

  it('caps pull results at maximum 500 records per batch', () => {
    // Populate server with 505 habits
    for (let i = 1; i <= 505; i++) {
      const h = createHabit({ nama: `Bulk Habit ${i}` });
      (harness.server as any).globalServerSeq++;
      const seq = (harness.server as any).globalServerSeq;
      harness.server.habits.set(h.id, { ...h, server_seq: seq });
    }

    const req = createSyncRequest([], { client_last_server_seq: 0 });
    const res = harness.server.handleSync(req, `Bearer ${harness.clientA.authToken}`);

    expect(res.status).toBe(200);
    const body = res.body as any;
    expect(body.changes.length).toBe(500);
    expect(body.has_more).toBe(true);
  });

  it('sets has_more to false when all remaining records are consumed', () => {
    // Populate server with exactly 50 records
    for (let i = 1; i <= 50; i++) {
      const h = createHabit({ nama: `Small Bulk ${i}` });
      (harness.server as any).globalServerSeq++;
      const seq = (harness.server as any).globalServerSeq;
      harness.server.habits.set(h.id, { ...h, server_seq: seq });
    }

    const req = createSyncRequest([], { client_last_server_seq: 0 });
    const res = harness.server.handleSync(req, `Bearer ${harness.clientA.authToken}`);

    expect(res.status).toBe(200);
    const body = res.body as any;
    expect(body.changes.length).toBe(50);
    expect(body.has_more).toBe(false);
  });

  it('returns records strictly ordered ascending by server_seq', () => {
    for (let i = 1; i <= 10; i++) {
      const h = createHabit({ nama: `Ordered Habit ${i}` });
      (harness.server as any).globalServerSeq++;
      const seq = (harness.server as any).globalServerSeq;
      harness.server.habits.set(h.id, { ...h, server_seq: seq });
    }

    const req = createSyncRequest([], { client_last_server_seq: 0 });
    const res = harness.server.handleSync(req, `Bearer ${harness.clientA.authToken}`);

    const changes = (res.body as any).changes;
    for (let i = 1; i < changes.length; i++) {
      expect(changes[i].record.server_seq).toBeGreaterThan(changes[i - 1].record.server_seq);
    }
  });

  it('returns empty changes array with has_more=false when client is fully up to date', () => {
    const h = createHabit({ nama: 'Synced Habit' });
    (harness.server as any).globalServerSeq++;
    const currentSeq = (harness.server as any).globalServerSeq;
    harness.server.habits.set(h.id, { ...h, server_seq: currentSeq });

    const req = createSyncRequest([], { client_last_server_seq: currentSeq });
    const res = harness.server.handleSync(req, `Bearer ${harness.clientA.authToken}`);

    const body = res.body as any;
    expect(body.changes.length).toBe(0);
    expect(body.has_more).toBe(false);
    expect(body.new_server_seq).toBe(currentSeq);
  });
});
