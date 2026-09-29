import { describe, it, expect } from 'vitest';
import {
  categorySchema,
  habitSchema,
  habitScheduleSchema,
  habitLogSchema,
  settingSchema,
  syncRequestSchema,
  syncResponseSchema
} from '../src/schemas/index.js';

describe('Domain Schemas Validation (T002)', () => {
  const validUuid = '123e4567-e89b-12d3-a456-426614174000';
  const nowIso = new Date().toISOString();

  describe('categorySchema', () => {
    it('validates a valid category', () => {
      const data = {
        id: validUuid,
        nama: 'Kesehatan',
        updated_at: nowIso,
        deleted_at: null,
        device_id: 'device-laptop-1'
      };
      const parsed = categorySchema.parse(data);
      expect(parsed.nama).toBe('Kesehatan');
      expect(parsed.deleted_at).toBeNull();
    });

    it('rejects empty category name', () => {
      const data = {
        id: validUuid,
        nama: '',
        updated_at: nowIso,
        deleted_at: null,
        device_id: 'device-1'
      };
      expect(() => categorySchema.parse(data)).toThrow();
    });
  });

  describe('habitSchema', () => {
    it('validates checklist habit', () => {
      const data = {
        id: validUuid,
        nama: 'Minum Air 2L',
        category_id: validUuid,
        mode: 'checklist' as const,
        satuan: null,
        archived: false,
        created_date: '2026-09-29',
        updated_at: nowIso,
        deleted_at: null,
        device_id: 'device-1'
      };
      const parsed = habitSchema.parse(data);
      expect(parsed.mode).toBe('checklist');
    });

    it('validates quantitative habit with unit', () => {
      const data = {
        id: validUuid,
        nama: 'Membaca Buku',
        category_id: null,
        mode: 'quantitative' as const,
        satuan: 'halaman',
        archived: false,
        created_date: '2026-09-29',
        updated_at: nowIso,
        deleted_at: null,
        device_id: 'device-1'
      };
      const parsed = habitSchema.parse(data);
      expect(parsed.satuan).toBe('halaman');
    });

    it('rejects invalid date format for created_date', () => {
      const data = {
        id: validUuid,
        nama: 'Invalid Date Habit',
        category_id: null,
        mode: 'checklist' as const,
        satuan: null,
        archived: false,
        created_date: '29-09-2026', // wrong format
        updated_at: nowIso,
        deleted_at: null,
        device_id: 'device-1'
      };
      expect(() => habitSchema.parse(data)).toThrow();
    });
  });

  describe('habitScheduleSchema', () => {
    it('validates daily schedule', () => {
      const data = {
        id: validUuid,
        habit_id: validUuid,
        tipe_frekuensi: 'daily' as const,
        hari_terjadwal: null,
        jumlah_per_minggu: null,
        target: 1,
        effective_from: '2026-09-01',
        updated_at: nowIso,
        deleted_at: null,
        device_id: 'device-1'
      };
      const parsed = habitScheduleSchema.parse(data);
      expect(parsed.tipe_frekuensi).toBe('daily');
    });

    it('validates specific days schedule', () => {
      const data = {
        id: validUuid,
        habit_id: validUuid,
        tipe_frekuensi: 'specific_days' as const,
        hari_terjadwal: [1, 3, 5],
        jumlah_per_minggu: null,
        target: 30,
        effective_from: '2026-09-01',
        updated_at: nowIso,
        deleted_at: null,
        device_id: 'device-1'
      };
      const parsed = habitScheduleSchema.parse(data);
      expect(parsed.hari_terjadwal).toEqual([1, 3, 5]);
    });

    it('validates x_per_week schedule', () => {
      const data = {
        id: validUuid,
        habit_id: validUuid,
        tipe_frekuensi: 'x_per_week' as const,
        hari_terjadwal: null,
        jumlah_per_minggu: 3,
        target: 1,
        effective_from: '2026-09-01',
        updated_at: nowIso,
        deleted_at: null,
        device_id: 'device-1'
      };
      const parsed = habitScheduleSchema.parse(data);
      expect(parsed.jumlah_per_minggu).toBe(3);
    });
  });

  describe('habitLogSchema', () => {
    it('validates completed log', () => {
      const data = {
        id: validUuid,
        habit_id: validUuid,
        tanggal: '2026-09-29',
        nilai: 30,
        selesai: true,
        updated_at: nowIso,
        deleted_at: null,
        device_id: 'device-1'
      };
      const parsed = habitLogSchema.parse(data);
      expect(parsed.selesai).toBe(true);
      expect(parsed.nilai).toBe(30);
    });

    it('validates uncompleted partial log', () => {
      const data = {
        id: validUuid,
        habit_id: validUuid,
        tanggal: '2026-09-29',
        nilai: 15,
        selesai: false,
        updated_at: nowIso,
        deleted_at: null,
        device_id: 'device-1'
      };
      const parsed = habitLogSchema.parse(data);
      expect(parsed.selesai).toBe(false);
      expect(parsed.nilai).toBe(15);
    });
  });

  describe('settingSchema', () => {
    it('validates custom day start hour and theme', () => {
      const data = {
        id: validUuid,
        jam_mulai_hari: '04:00',
        theme: 'dark' as const,
        device_id: 'device-1',
        device_token_hash: null,
        updated_at: nowIso,
        deleted_at: null
      };
      const parsed = settingSchema.parse(data);
      expect(parsed.jam_mulai_hari).toBe('04:00');
      expect(parsed.theme).toBe('dark');
    });

    it('rejects invalid jam_mulai_hari format', () => {
      const data = {
        id: validUuid,
        jam_mulai_hari: '25:00', // invalid hour
        theme: 'dark' as const,
        device_id: 'device-1',
        device_token_hash: null,
        updated_at: nowIso,
        deleted_at: null
      };
      expect(() => settingSchema.parse(data)).toThrow();
    });
  });

  describe('syncProtocolSchema', () => {
    it('validates a sync request with mutations', () => {
      const req = {
        protocol_version: 1,
        device_id: validUuid,
        client_time: nowIso,
        client_last_server_seq: 42,
        mutations: [
          {
            mutation_id: validUuid,
            table: 'habits' as const,
            record: {
              id: validUuid,
              nama: 'Olahraga',
              category_id: null,
              mode: 'checklist' as const,
              satuan: null,
              archived: false,
              created_date: '2026-09-29',
              updated_at: nowIso,
              deleted_at: null,
              device_id: validUuid
            }
          }
        ]
      };
      const parsed = syncRequestSchema.parse(req);
      expect(parsed.mutations.length).toBe(1);
      expect(parsed.protocol_version).toBe(1);
    });

    it('validates a sync response', () => {
      const res = {
        server_time: nowIso,
        applied: [validUuid],
        rejected: [{ mutation_id: 'mut-fail', reason: 'Clock skew detected' }],
        changes: [],
        new_server_seq: 43,
        has_more: false
      };
      const parsed = syncResponseSchema.parse(res);
      expect(parsed.applied.length).toBe(1);
      expect(parsed.rejected.length).toBe(1);
      expect(parsed.has_more).toBe(false);
    });
  });
});
