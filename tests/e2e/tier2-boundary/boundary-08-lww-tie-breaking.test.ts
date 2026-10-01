import { describe, it, expect } from 'vitest';
import { compareLww, doesIncomingWinLww } from '@vibehabit/shared';

describe('Tier 2 - Boundary 08: LWW Deterministic Tie-Breaking', () => {
  it('strictly orders by sub-millisecond timestamp difference', () => {
    const r1 = { updated_at: '2026-09-29T10:00:00.001Z', device_id: 'device-01' };
    const r2 = { updated_at: '2026-09-29T10:00:00.002Z', device_id: 'device-01' };

    expect(compareLww(r2, r1)).toBe(1); // r2 wins
    expect(compareLww(r1, r2)).toBe(-1); // r1 loses
  });

  it('tie-breaks by ASCII lexicographical order when timestamps are identical', () => {
    const timestamp = '2026-09-29T12:00:00.000Z';
    const rA = { updated_at: timestamp, device_id: 'device-A' };
    const rB = { updated_at: timestamp, device_id: 'device-B' };

    // 'device-B' > 'device-A' in ASCII
    expect(compareLww(rB, rA)).toBe(1);
    expect(compareLww(rA, rB)).toBe(-1);
  });

  it('orders case-sensitively in ASCII (uppercase < lowercase)', () => {
    const timestamp = '2026-09-29T12:00:00.000Z';
    const rUpper = { updated_at: timestamp, device_id: 'device-Z' };
    const rLower = { updated_at: timestamp, device_id: 'device-a' };

    // 'device-a' (0x61) > 'device-Z' (0x5A) in ASCII
    expect(compareLww(rLower, rUpper)).toBe(1);
  });

  it('returns 0 for completely identical timestamp and device_id (idempotency)', () => {
    const timestamp = '2026-09-29T12:00:00.000Z';
    const r1 = { updated_at: timestamp, device_id: 'device-01' };
    const r2 = { updated_at: timestamp, device_id: 'device-01' };

    expect(compareLww(r1, r2)).toBe(0);
    expect(doesIncomingWinLww(r1, r2)).toBe(false);
  });

  it('incoming wins unconditionally when existing record is null or undefined', () => {
    const r = { updated_at: '2026-09-29T12:00:00.000Z', device_id: 'device-01' };
    expect(compareLww(r, null)).toBe(1);
    expect(compareLww(r, undefined)).toBe(1);
    expect(doesIncomingWinLww(r, null)).toBe(true);
  });
});
