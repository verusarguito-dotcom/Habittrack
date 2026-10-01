import type { FastifyPluginAsync } from 'fastify';
import { sql, type Kysely, type Transaction } from 'kysely';
import {
  syncRequestSchema,
  compareLww,
  categorySchema,
  habitSchema,
  habitScheduleSchema,
  habitLogSchema,
  settingSchema,
  type SyncRequest,
  type SyncResponse,
  type SyncTable,
  type SyncRejectedItem,
  type SyncMutation,
  type Category,
  type Habit,
  type HabitSchedule,
  type HabitLog,
  type Setting
} from '@vibehabit/shared';
import type { Database } from '../db/types.js';
import { createAuthPreHandler } from '../middleware/auth.js';

export interface SyncRouteOptions {
  db?: Kysely<Database>;
  deviceTokens?: Record<string, string>;
  getTimeOffsetMs?: () => number;
  isAdvisoryLockHeld?: () => boolean;
}

function toLwwRecord(r: { updated_at: string | Date; device_id: string }): { updated_at: string; device_id: string } {
  return {
    updated_at: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
    device_id: r.device_id
  };
}

async function applyMutation(trx: Transaction<Database>, mutation: SyncMutation): Promise<void> {
  const { table, record } = mutation;

  switch (table) {
    case 'categories': {
      const cat = record as Category;
      const existing = await trx
        .selectFrom('categories')
        .select(['id', 'updated_at', 'device_id', 'server_seq'])
        .where('id', '=', cat.id)
        .executeTakeFirst();

      if (!existing) {
        await trx
          .insertInto('categories')
          .values({
            id: cat.id,
            nama: cat.nama,
            updated_at: cat.updated_at,
            deleted_at: cat.deleted_at ?? null,
            device_id: cat.device_id,
            server_seq: sql`nextval('vibehabit_server_seq')`
          })
          .execute();
      } else {
        const cmp = compareLww(cat, toLwwRecord(existing));
        if (cmp > 0) {
          await trx
            .updateTable('categories')
            .set({
              nama: cat.nama,
              updated_at: cat.updated_at,
              deleted_at: cat.deleted_at ?? null,
              device_id: cat.device_id,
              server_seq: sql`nextval('vibehabit_server_seq')`
            })
            .where('id', '=', cat.id)
            .execute();
        }
      }
      break;
    }

    case 'habits': {
      const habit = record as Habit;
      const existing = await trx
        .selectFrom('habits')
        .select(['id', 'updated_at', 'device_id', 'server_seq'])
        .where('id', '=', habit.id)
        .executeTakeFirst();

      if (!existing) {
        await trx
          .insertInto('habits')
          .values({
            id: habit.id,
            nama: habit.nama,
            category_id: habit.category_id ?? null,
            mode: habit.mode,
            satuan: habit.satuan ?? null,
            archived: habit.archived ?? false,
            created_date: habit.created_date,
            updated_at: habit.updated_at,
            deleted_at: habit.deleted_at ?? null,
            device_id: habit.device_id,
            server_seq: sql`nextval('vibehabit_server_seq')`
          })
          .execute();
      } else {
        const cmp = compareLww(habit, toLwwRecord(existing));
        if (cmp > 0) {
          await trx
            .updateTable('habits')
            .set({
              nama: habit.nama,
              category_id: habit.category_id ?? null,
              mode: habit.mode,
              satuan: habit.satuan ?? null,
              archived: habit.archived ?? false,
              created_date: habit.created_date,
              updated_at: habit.updated_at,
              deleted_at: habit.deleted_at ?? null,
              device_id: habit.device_id,
              server_seq: sql`nextval('vibehabit_server_seq')`
            })
            .where('id', '=', habit.id)
            .execute();
        }
      }
      break;
    }

    case 'habit_schedules': {
      const sched = record as HabitSchedule;
      const existing = await trx
        .selectFrom('habit_schedules')
        .select(['id', 'updated_at', 'device_id', 'server_seq'])
        .where('id', '=', sched.id)
        .executeTakeFirst();

      const hariTerjadwalVal = sched.hari_terjadwal
        ? sql<string>`${JSON.stringify(sched.hari_terjadwal)}::jsonb`
        : null;

      if (!existing) {
        await trx
          .insertInto('habit_schedules')
          .values({
            id: sched.id,
            habit_id: sched.habit_id,
            tipe_frekuensi: sched.tipe_frekuensi,
            hari_terjadwal: hariTerjadwalVal,
            jumlah_per_minggu: sched.jumlah_per_minggu ?? null,
            target: sched.target ?? null,
            effective_from: sched.effective_from,
            updated_at: sched.updated_at,
            deleted_at: sched.deleted_at ?? null,
            device_id: sched.device_id,
            server_seq: sql`nextval('vibehabit_server_seq')`
          })
          .execute();
      } else {
        const cmp = compareLww(sched, toLwwRecord(existing));
        if (cmp > 0) {
          await trx
            .updateTable('habit_schedules')
            .set({
              habit_id: sched.habit_id,
              tipe_frekuensi: sched.tipe_frekuensi,
              hari_terjadwal: hariTerjadwalVal,
              jumlah_per_minggu: sched.jumlah_per_minggu ?? null,
              target: sched.target ?? null,
              effective_from: sched.effective_from,
              updated_at: sched.updated_at,
              deleted_at: sched.deleted_at ?? null,
              device_id: sched.device_id,
              server_seq: sql`nextval('vibehabit_server_seq')`
            })
            .where('id', '=', sched.id)
            .execute();
        }
      }
      break;
    }

    case 'logs': {
      const log = record as HabitLog;

      const existingById = await trx
        .selectFrom('logs')
        .select(['id', 'habit_id', 'tanggal', 'updated_at', 'device_id', 'server_seq'])
        .where('id', '=', log.id)
        .executeTakeFirst();

      const existingByHabitDate = await trx
        .selectFrom('logs')
        .select(['id', 'habit_id', 'tanggal', 'updated_at', 'device_id', 'server_seq'])
        .where('habit_id', '=', log.habit_id)
        .where('tanggal', '=', log.tanggal)
        .executeTakeFirst();

      if (existingByHabitDate && existingByHabitDate.id !== log.id) {
        // Conflicting record with different ID for same (habit_id, tanggal)
        const cmp = compareLww(log, toLwwRecord(existingByHabitDate));
        if (cmp > 0) {
          // Incoming strictly wins over existing conflicting record: delete conflicting row
          await trx.deleteFrom('logs').where('id', '=', existingByHabitDate.id).execute();

          if (existingById) {
            await trx
              .updateTable('logs')
              .set({
                habit_id: log.habit_id,
                tanggal: log.tanggal,
                nilai: log.nilai ?? null,
                selesai: log.selesai ?? false,
                updated_at: log.updated_at,
                deleted_at: log.deleted_at ?? null,
                device_id: log.device_id,
                server_seq: sql`nextval('vibehabit_server_seq')`
              })
              .where('id', '=', log.id)
              .execute();
          } else {
            await trx
              .insertInto('logs')
              .values({
                id: log.id,
                habit_id: log.habit_id,
                tanggal: log.tanggal,
                nilai: log.nilai ?? null,
                selesai: log.selesai ?? false,
                updated_at: log.updated_at,
                deleted_at: log.deleted_at ?? null,
                device_id: log.device_id,
                server_seq: sql`nextval('vibehabit_server_seq')`
              })
              .execute();
          }
        }
        // If cmp <= 0, incoming loses to the conflicting record: do not write
      } else {
        const existing = existingById ?? existingByHabitDate;
        if (!existing) {
          await trx
            .insertInto('logs')
            .values({
              id: log.id,
              habit_id: log.habit_id,
              tanggal: log.tanggal,
              nilai: log.nilai ?? null,
              selesai: log.selesai ?? false,
              updated_at: log.updated_at,
              deleted_at: log.deleted_at ?? null,
              device_id: log.device_id,
              server_seq: sql`nextval('vibehabit_server_seq')`
            })
            .execute();
        } else {
          const cmp = compareLww(log, toLwwRecord(existing));
          if (cmp > 0) {
            await trx
              .updateTable('logs')
              .set({
                habit_id: log.habit_id,
                tanggal: log.tanggal,
                nilai: log.nilai ?? null,
                selesai: log.selesai ?? false,
                updated_at: log.updated_at,
                deleted_at: log.deleted_at ?? null,
                device_id: log.device_id,
                server_seq: sql`nextval('vibehabit_server_seq')`
              })
              .where('id', '=', existing.id)
              .execute();
          }
        }
      }
      break;
    }

    case 'settings': {
      const setting = record as Setting;
      const existing = await trx
        .selectFrom('settings')
        .select(['id', 'updated_at', 'device_id', 'server_seq'])
        .where('id', '=', setting.id)
        .executeTakeFirst();

      if (!existing) {
        await trx
          .insertInto('settings')
          .values({
            id: setting.id,
            jam_mulai_hari: setting.jam_mulai_hari ?? '00:00',
            theme: setting.theme ?? 'system',
            // SECURITY [VULN-2]: device_token_hash TIDAK disinkronkan ke server
            // agar hash token auth tidak tersebar ke perangkat lain via sync
            device_token_hash: null,
            updated_at: setting.updated_at,
            deleted_at: setting.deleted_at ?? null,
            device_id: setting.device_id,
            server_seq: sql`nextval('vibehabit_server_seq')`
          })
          .execute();
      } else {
        const cmp = compareLww(setting, toLwwRecord(existing));
        if (cmp > 0) {
          await trx
            .updateTable('settings')
            .set({
              jam_mulai_hari: setting.jam_mulai_hari ?? '00:00',
              theme: setting.theme ?? 'system',
              // SECURITY [VULN-2]: device_token_hash TIDAK disinkronkan ke server
              device_token_hash: null,
              updated_at: setting.updated_at,
              deleted_at: setting.deleted_at ?? null,
              device_id: setting.device_id,
              server_seq: sql`nextval('vibehabit_server_seq')`
            })
            .where('id', '=', setting.id)
            .execute();
        }
      }
      break;
    }
  }
}

export async function executeSyncTransaction(
  db: Kysely<Database>,
  syncRequest: SyncRequest,
  serverTimeMs: number,
  serverTimeIso: string,
  skewThresholdMs: number
): Promise<SyncResponse> {
  return await db.transaction().execute(async (trx) => {
    // 1. Acquire advisory transaction lock
    const lockResult = await sql<{ locked: boolean }>`
      SELECT pg_try_advisory_xact_lock(hashtext('vibehabit_sync')) as locked
    `.execute(trx);

    const isLocked = lockResult.rows[0]?.locked;
    if (isLocked === false) {
      throw new Error('LOCK_CONTENTION');
    }

    const applied: string[] = [];
    const rejected: SyncRejectedItem[] = [];

    // Sort mutations topologically: categories -> habits -> habit_schedules -> logs -> settings
    const tableOrder: Record<SyncTable, number> = {
      categories: 1,
      habits: 2,
      habit_schedules: 3,
      logs: 4,
      settings: 5
    };

    const sortedMutations = [...syncRequest.mutations].sort(
      (a, b) => tableOrder[a.table] - tableOrder[b.table]
    );

    // 2. Process mutations
    for (const mutation of sortedMutations) {
      const { mutation_id, record } = mutation;
      const updatedTimeMs = new Date(record.updated_at).getTime();

      // Reject individual mutation if updated_at is > 5 minutes in future
      if (updatedTimeMs > serverTimeMs + skewThresholdMs) {
        rejected.push({
          mutation_id,
          reason: `Mutation updated_at is in the future (>5 minutes): ${record.updated_at}`
        });
        continue;
      }

      // Validate mutation record conforms strictly to its target table schema
      let recordParseResult;
      switch (mutation.table) {
        case 'categories':
          recordParseResult = categorySchema.safeParse(record);
          break;
        case 'habits':
          recordParseResult = habitSchema.safeParse(record);
          break;
        case 'habit_schedules':
          recordParseResult = habitScheduleSchema.safeParse(record);
          break;
        case 'logs':
          recordParseResult = habitLogSchema.safeParse(record);
          break;
        case 'settings':
          recordParseResult = settingSchema.safeParse(record);
          break;
      }

      if (!recordParseResult.success) {
        rejected.push({
          mutation_id,
          reason: `Invalid record structure for table '${mutation.table}': ${recordParseResult.error.issues.map((i) => i.message).join('; ')}`
        });
        continue;
      }

      await applyMutation(trx, { ...mutation, record: recordParseResult.data });
      applied.push(mutation_id);
    }

    // 3. Pull query: select records where server_seq > client_last_server_seq, ordered by server_seq asc, max 500
    const sinceSeq = syncRequest.client_last_server_seq;
    const limit = 500;

    const [catRows, habitRows, schedRows, logRows, settingRows] = await Promise.all([
      trx.selectFrom('categories').selectAll().where('server_seq', '>', sinceSeq).orderBy('server_seq', 'asc').limit(limit + 1).execute(),
      trx.selectFrom('habits').selectAll().where('server_seq', '>', sinceSeq).orderBy('server_seq', 'asc').limit(limit + 1).execute(),
      trx.selectFrom('habit_schedules').selectAll().where('server_seq', '>', sinceSeq).orderBy('server_seq', 'asc').limit(limit + 1).execute(),
      trx.selectFrom('logs').selectAll().where('server_seq', '>', sinceSeq).orderBy('server_seq', 'asc').limit(limit + 1).execute(),
      trx.selectFrom('settings').selectAll().where('server_seq', '>', sinceSeq).orderBy('server_seq', 'asc').limit(limit + 1).execute()
    ]);

    const allChanges: Array<{ table: SyncTable; record: any }> = [];

    for (const r of catRows) {
      allChanges.push({ table: 'categories', record: { ...r, server_seq: Number(r.server_seq) } });
    }
    for (const r of habitRows) {
      allChanges.push({ table: 'habits', record: { ...r, server_seq: Number(r.server_seq) } });
    }
    for (const r of schedRows) {
      let scheduleRecord: any = r;
      if (typeof scheduleRecord.hari_terjadwal === 'string') {
        try {
          scheduleRecord = { ...scheduleRecord, hari_terjadwal: JSON.parse(scheduleRecord.hari_terjadwal) };
        } catch {
          // keep as is
        }
      }
      allChanges.push({ table: 'habit_schedules', record: { ...scheduleRecord, server_seq: Number(scheduleRecord.server_seq) } });
    }
    for (const r of logRows) {
      allChanges.push({ table: 'logs', record: { ...r, server_seq: Number(r.server_seq) } });
    }
    for (const r of settingRows) {
      allChanges.push({ table: 'settings', record: { ...r, server_seq: Number(r.server_seq) } });
    }

    // Sort strictly ascending by server_seq
    allChanges.sort((a, b) => Number(a.record.server_seq) - Number(b.record.server_seq));

    const hasMore = allChanges.length > limit;
    const paginatedChanges = allChanges.slice(0, limit);

    let newServerSeq: number;
    if (paginatedChanges.length > 0) {
      newServerSeq = Number(paginatedChanges[paginatedChanges.length - 1]!.record.server_seq);
    } else {
      let currentSeq = 0;
      try {
        // Query pg_sequences catalog view (standard PostgreSQL 10+)
        const seqRow = await sql<{ last_value: string | number; is_called: boolean }>`
          SELECT last_value, is_called FROM pg_sequences WHERE sequencename = 'vibehabit_server_seq'
        `.execute(trx);
        if (seqRow.rows.length > 0) {
          const row = seqRow.rows[0]!;
          currentSeq = row.is_called ? Number(row.last_value) : 0;
        }
      } catch {
        try {
          // Fallback for mock environments or legacy sequence relations
          const seqRow = await sql<{ last_value: string | number; is_called: boolean }>`
            SELECT last_value, is_called FROM vibehabit_server_seq
          `.execute(trx);
          if (seqRow.rows.length > 0) {
            const row = seqRow.rows[0]!;
            currentSeq = row.is_called ? Number(row.last_value) : 0;
          }
        } catch {
          currentSeq = 0;
        }
      }
      newServerSeq = Math.max(sinceSeq, currentSeq);
    }

    return {
      server_time: serverTimeIso,
      applied,
      rejected,
      changes: paginatedChanges,
      new_server_seq: newServerSeq,
      has_more: hasMore
    };
  });
}

export const syncRoutes: FastifyPluginAsync<SyncRouteOptions> = async (fastify, options) => {
  const deviceTokens = options.deviceTokens ?? {};

  fastify.post(
    '/sync',
    {
      // VULN-3 SECURITY: Rate limiting — 60 request/menit per IP
      config: {
        rateLimit: {
          max: 60,
          timeWindow: '1 minute',
          errorResponseBuilder: () => ({
            error: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many sync requests. Please wait before retrying.'
          })
        }
      },
      preHandler: createAuthPreHandler(deviceTokens)
    },
    async (request, reply) => {
      // 1. Validate payload schema
      const parseResult = syncRequestSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Invalid sync request payload',
          details: parseResult.error.format()
        });
      }

      const syncRequest = parseResult.data as SyncRequest;

      // 2. Validate protocol version
      if (syncRequest.protocol_version !== 1) {
        return reply.status(426).send({
          error: 'UPGRADE_REQUIRED',
          message: `Unsupported protocol version ${syncRequest.protocol_version}. Only version 1 is supported.`
        });
      }

      // 3. Compute server time and validate clock skew
      const offset = options.getTimeOffsetMs ? options.getTimeOffsetMs() : 0;
      const serverTimeMs = Date.now() + offset;
      const serverTime = new Date(serverTimeMs);
      const serverTimeIso = serverTime.toISOString();
      const clientTimeMs = new Date(syncRequest.client_time).getTime();
      const skewThresholdMs = 5 * 60 * 1000; // 5 minutes = 300,000 ms

      if (Math.abs(clientTimeMs - serverTimeMs) > skewThresholdMs) {
        return reply.status(409).send({
          error: 'CLOCK_SKEW',
          message: `Client clock skew (${Math.abs(clientTimeMs - serverTimeMs)}ms) exceeds 5 minutes threshold`,
          server_time: serverTimeIso
        });
      }

      // 4. Ensure database is available
      if (!options.db) {
        return reply.status(503).send({
          error: 'SERVICE_UNAVAILABLE',
          message: 'Database connection not available'
        });
      }

      // 5. Check simulated advisory lock contention hook if provided
      if (options.isAdvisoryLockHeld && options.isAdvisoryLockHeld()) {
        return reply.status(503).send({
          error: 'LOCK_CONTENTION',
          message: 'Sync lock currently held by concurrent transaction'
        });
      }

      // 6. Execute atomic sync transaction
      try {
        const responseBody = await executeSyncTransaction(
          options.db,
          syncRequest,
          serverTimeMs,
          serverTimeIso,
          skewThresholdMs
        );
        return reply.status(200).send(responseBody);
      } catch (err: any) {
        if (err.message === 'LOCK_CONTENTION') {
          return reply.status(503).send({
            error: 'LOCK_CONTENTION',
            message: 'Sync lock currently held by concurrent transaction'
          });
        }
        // SECURITY [VULN-4]: Jangan bocorkan detail error DB mentah ke client
        // Log detail di server, kirim pesan generik ke client
        request.log.error({ err }, 'Sync transaction failed');
        return reply.status(500).send({
          error: 'TRANSACTION_FAILED',
          message: 'Internal server error during sync transaction'
        });
      }
    }
  );
};
