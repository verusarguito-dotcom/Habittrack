import { describe, it, expect } from 'vitest';
import {
  generateLogId,
  uuidv5,
  VIBEHABIT_NAMESPACE,
  compareLww,
  doesIncomingWinLww,
  resolveLwwConflict,
  formatLocalDate,
  parseLocalDate,
  getEffectiveDate,
  addDays,
  daysBetween,
  getDayOfWeek,
  getStartOfWeek,
  getEndOfWeek,
  generateDateRange
} from '../src/logic/index.js';

describe('Domain Pure Utilities (T003)', () => {
  describe('UUID v5 and Deterministic Log ID', () => {
    it('matches RFC 4122 test vector for python.org with DNS namespace', () => {
      // RFC 4122 test vector:
      // Name: "python.org", Namespace: DNS ("6ba7b810-9dad-11d1-80b4-00c04fd430c8")
      // Expected UUID v5: "886313e1-3b8a-5372-9b90-0c9aee199e5d"
      const result = uuidv5('python.org', '6ba7b810-9dad-11d1-80b4-00c04fd430c8');
      expect(result.toLowerCase()).toBe('886313e1-3b8a-5372-9b90-0c9aee199e5d');
    });

    it('generates deterministic log ID for habit_id + ":" + date', () => {
      const habitId = 'c8b66380-4966-4f36-96a9-d3e9c40d99a2';
      const date = '2026-09-29';
      const id1 = generateLogId(habitId, date);
      const id2 = generateLogId(habitId, date);

      expect(id1).toBe(id2);
      expect(id1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('generates different IDs for different dates or habit IDs', () => {
      const habitId1 = 'c8b66380-4966-4f36-96a9-d3e9c40d99a2';
      const habitId2 = 'a1111111-2222-3333-4444-555555555555';
      const date1 = '2026-09-29';
      const date2 = '2026-09-30';

      expect(generateLogId(habitId1, date1)).not.toBe(generateLogId(habitId1, date2));
      expect(generateLogId(habitId1, date1)).not.toBe(generateLogId(habitId2, date1));
    });
  });

  describe('LWW Comparator with device_id Tie-Break', () => {
    const baseRecord = {
      id: 'record-1',
      updated_at: '2026-09-29T10:00:00.000Z',
      deleted_at: null,
      device_id: 'device-b'
    };

    it('incoming wins when existing record is null or undefined', () => {
      expect(compareLww(baseRecord, null)).toBeGreaterThan(0);
      expect(compareLww(baseRecord, undefined)).toBeGreaterThan(0);
      expect(doesIncomingWinLww(baseRecord, null)).toBe(true);
    });

    it('incoming wins when updated_at is later', () => {
      const newer = {
        ...baseRecord,
        updated_at: '2026-09-29T10:05:00.000Z',
        device_id: 'device-a' // even if device_id is alphabetically lower
      };
      expect(compareLww(newer, baseRecord)).toBeGreaterThan(0);
      expect(doesIncomingWinLww(newer, baseRecord)).toBe(true);
    });

    it('incoming loses when updated_at is earlier', () => {
      const older = {
        ...baseRecord,
        updated_at: '2026-09-29T09:55:00.000Z',
        device_id: 'device-z' // even if device_id is alphabetically higher
      };
      expect(compareLww(older, baseRecord)).toBeLessThan(0);
      expect(doesIncomingWinLww(older, baseRecord)).toBe(false);
    });

    it('tie-break: when updated_at is identical, higher device_id wins', () => {
      const incomingHigherDevice = {
        ...baseRecord,
        device_id: 'device-c' // 'device-c' > 'device-b'
      };
      expect(compareLww(incomingHigherDevice, baseRecord)).toBeGreaterThan(0);
      expect(doesIncomingWinLww(incomingHigherDevice, baseRecord)).toBe(true);

      const incomingLowerDevice = {
        ...baseRecord,
        device_id: 'device-a' // 'device-a' < 'device-b'
      };
      expect(compareLww(incomingLowerDevice, baseRecord)).toBeLessThan(0);
      expect(doesIncomingWinLww(incomingLowerDevice, baseRecord)).toBe(false);
    });

    it('idempotency: identical updated_at and device_id results in 0 (no strict win)', () => {
      const identical = { ...baseRecord };
      expect(compareLww(identical, baseRecord)).toBe(0);
      expect(doesIncomingWinLww(identical, baseRecord)).toBe(false);
    });

    it('resolveLwwConflict returns winner and winner status', () => {
      const existing = { ...baseRecord };
      const newer = { ...baseRecord, updated_at: '2026-09-29T11:00:00.000Z' };

      const resWin = resolveLwwConflict(newer, existing);
      expect(resWin.isIncomingWinner).toBe(true);
      expect(resWin.winner).toBe(newer);

      const resLose = resolveLwwConflict(existing, newer);
      expect(resLose.isIncomingWinner).toBe(false);
      expect(resLose.winner).toBe(newer);
    });
  });

  describe('Date Conversion & Day Start Hour Offset', () => {
    it('formats local Date to YYYY-MM-DD', () => {
      const date = new Date(2026, 8, 29); // September 29, 2026
      expect(formatLocalDate(date)).toBe('2026-09-29');
    });

    it('parses YYYY-MM-DD string into local midnight Date', () => {
      const parsed = parseLocalDate('2026-09-29');
      expect(parsed.getFullYear()).toBe(2026);
      expect(parsed.getMonth()).toBe(8);
      expect(parsed.getDate()).toBe(29);
    });

    it('getEffectiveDate with default 00:00 offset keeps standard day', () => {
      const earlyMorning = new Date(2026, 8, 29, 1, 30); // 01:30
      expect(getEffectiveDate(earlyMorning, '00:00')).toBe('2026-09-29');
      expect(getEffectiveDate(earlyMorning)).toBe('2026-09-29');
    });

    it('getEffectiveDate with 04:00 offset shifts nocturnal hours to previous day', () => {
      // 03:59:59 on September 29 belongs to September 28
      const justBefore4am = new Date(2026, 8, 29, 3, 59, 59);
      expect(getEffectiveDate(justBefore4am, '04:00')).toBe('2026-09-28');

      // 04:00:00 on September 29 belongs to September 29
      const exactly4am = new Date(2026, 8, 29, 4, 0, 0);
      expect(getEffectiveDate(exactly4am, '04:00')).toBe('2026-09-29');

      // 23:59:00 on September 29 belongs to September 29
      const lateNight = new Date(2026, 8, 29, 23, 59, 0);
      expect(getEffectiveDate(lateNight, '04:00')).toBe('2026-09-29');

      // 01:00 on September 30 belongs to September 29
      const pastMidnightNextDay = new Date(2026, 8, 30, 1, 0, 0);
      expect(getEffectiveDate(pastMidnightNextDay, '04:00')).toBe('2026-09-29');
    });

    it('adds and subtracts days correctly across month boundaries', () => {
      expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
      expect(addDays('2026-09-01', -1)).toBe('2026-08-31');
      expect(addDays('2026-02-28', 1)).toBe('2026-03-01'); // 2026 is non-leap
    });

    it('calculates daysBetween two local date strings', () => {
      expect(daysBetween('2026-09-01', '2026-09-10')).toBe(9);
      expect(daysBetween('2026-09-10', '2026-09-01')).toBe(-9);
      expect(daysBetween('2026-09-01', '2026-09-01')).toBe(0);
    });

    it('getDayOfWeek returns 1 for Monday to 7 for Sunday (ISO 8601)', () => {
      // 2026-09-28 is Monday
      expect(getDayOfWeek('2026-09-28')).toBe(1);
      // 2026-09-29 is Tuesday
      expect(getDayOfWeek('2026-09-29')).toBe(2);
      // 2026-10-04 is Sunday
      expect(getDayOfWeek('2026-10-04')).toBe(7);
    });

    it('getStartOfWeek returns Monday and getEndOfWeek returns Sunday', () => {
      // 2026-09-30 is Wednesday
      expect(getStartOfWeek('2026-09-30')).toBe('2026-09-28'); // Monday
      expect(getEndOfWeek('2026-09-30')).toBe('2026-10-04'); // Sunday
    });

    it('generateDateRange produces inclusive array of dates', () => {
      const range = generateDateRange('2026-09-28', '2026-10-01');
      expect(range).toEqual(['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01']);
    });
  });
});
