import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTestHarness,
  createHabit,
  createSyncRequest,
  type TestHarness
} from '../harness/index.js';

describe('Tier 2 - Boundary 10: Pull Query Pagination Limits (500 row boundary)', () => {
  let harness: TestHarness;

  beforeEach(() => {
    harness = createTestHarness();
  });

  it('sets has_more=false when server has exactly 500 records', () => {
    for (let i = 1; i <= 500; i++) {
      const h = createHabit({ nama: `Exact 500 #${i}` });
      (harness.server as any).globalServerSeq++;
      const seq = (harness.server as any).globalServerSeq;
      harness.server.habits.set(h.id, { ...h, server_seq: seq });
    }

    const req = createSyncRequest([], { client_last_server_seq: 0 });
    const res = harness.server.handleSync(req, `Bearer ${harness.clientA.authToken}`);

    const body = res.body as any;
    expect(body.changes.length).toBe(500);
    expect(body.has_more).toBe(false); // Exactly at boundary: no more records left
  });

  it('sets has_more=true when server has 501 records, and second page has 1 record with has_more=false', () => {
    for (let i = 1; i <= 501; i++) {
      const h = createHabit({ nama: `Page Split #${i}` });
      (harness.server as any).globalServerSeq++;
      const seq = (harness.server as any).globalServerSeq;
      harness.server.habits.set(h.id, { ...h, server_seq: seq });
    }

    // Page 1
    const req1 = createSyncRequest([], { client_last_server_seq: 0 });
    const res1 = harness.server.handleSync(req1, `Bearer ${harness.clientA.authToken}`);
    const body1 = res1.body as any;
    expect(body1.changes.length).toBe(500);
    expect(body1.has_more).toBe(true);

    // Page 2
    const req2 = createSyncRequest([], { client_last_server_seq: body1.new_server_seq });
    const res2 = harness.server.handleSync(req2, `Bearer ${harness.clientA.authToken}`);
    const body2 = res2.body as any;
    expect(body2.changes.length).toBe(1);
    expect(body2.has_more).toBe(false);
  });

  it('handles client_last_server_seq beyond current server sequence gracefully', () => {
    const h = createHabit({ nama: 'Existing Habit' });
    (harness.server as any).globalServerSeq = 10;
    harness.server.habits.set(h.id, { ...h, server_seq: 10 });

    const req = createSyncRequest([], { client_last_server_seq: 99999 });
    const res = harness.server.handleSync(req, `Bearer ${harness.clientA.authToken}`);

    const body = res.body as any;
    expect(body.changes.length).toBe(0);
    expect(body.has_more).toBe(false);
    expect(body.new_server_seq).toBe(99999);
  });

  it('handles client_last_server_seq = 0 on completely empty server database', () => {
    const req = createSyncRequest([], { client_last_server_seq: 0 });
    const res = harness.server.handleSync(req, `Bearer ${harness.clientA.authToken}`);

    const body = res.body as any;
    expect(body.changes.length).toBe(0);
    expect(body.has_more).toBe(false);
    expect(body.new_server_seq).toBe(0);
  });

  it('paginates correctly across 3 distinct pages (1,150 records: 500, 500, 150)', async () => {
    for (let i = 1; i <= 1150; i++) {
      const h = createHabit({ nama: `Paged ${i}` });
      (harness.server as any).globalServerSeq++;
      const seq = (harness.server as any).globalServerSeq;
      harness.server.habits.set(h.id, { ...h, server_seq: seq });
    }

    const syncRes = await harness.clientA.sync(harness.server);
    expect(syncRes.success).toBe(true);
    expect(syncRes.loops).toBe(3); // 3 pages
    expect(harness.clientA.habits.size).toBe(1150);
  });
});
