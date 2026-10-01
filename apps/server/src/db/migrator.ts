import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sql, type Kysely } from 'kysely';
import type { Database } from './types.js';

function resolveMigrationsDir(customDir?: string): string {
  if (customDir && fs.existsSync(customDir)) {
    return customDir;
  }
  const cwdDir = path.resolve(process.cwd(), 'deploy/migrations');
  if (fs.existsSync(cwdDir)) {
    return cwdDir;
  }
  // Try relative to this source file (apps/server/src/db/migrator.ts -> ../../../deploy/migrations)
  try {
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    const moduleDir = path.resolve(currentDir, '../../../deploy/migrations');
    if (fs.existsSync(moduleDir)) {
      return moduleDir;
    }
  } catch {
    // ignore
  }
  return customDir ?? cwdDir;
}

export async function runMigrations(
  db: Kysely<Database>,
  migrationsDir?: string
): Promise<string[]> {
  const dir = resolveMigrationsDir(migrationsDir);
  if (!fs.existsSync(dir)) {
    throw new Error(`Migrations directory not found: ${dir}`);
  }

  // Ensure migrations tracking table exists
  await sql`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `.execute(db);

  // Read applied migrations
  const appliedRows = await sql<{ name: string }>`
    SELECT name FROM _migrations ORDER BY id ASC;
  `.execute(db);
  const appliedSet = new Set(appliedRows.rows.map((r) => r.name));

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const executed: string[] = [];

  for (const file of files) {
    if (!appliedSet.has(file)) {
      const filePath = path.join(dir, file);
      const sqlContent = fs.readFileSync(filePath, 'utf-8');

      // Execute migration in transaction
      await db.transaction().execute(async (trx) => {
        await sql.raw(sqlContent).execute(trx);
        await sql`
          INSERT INTO _migrations (name) VALUES (${file});
        `.execute(trx);
      });

      executed.push(file);
    }
  }

  return executed;
}
