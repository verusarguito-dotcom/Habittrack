import type { SyncRequest } from '@vibehabit/shared';
import { loadConfigFromEnv } from './config.js';
import { buildApp } from './app.js';
import { initDb, closeDb } from './db/index.js';

export const SERVER_NAME = 'VibeHabit Sync Server';
export type { SyncRequest };

export * from './config.js';
export * from './db/index.js';
export * from './middleware/auth.js';
export * from './routes/health.js';
export * from './routes/sync.js';
export * from './app.js';

export async function startServer() {
  // Fail-fast environment validation
  const config = loadConfigFromEnv();

  // Initialize database connection
  const db = initDb(config.databaseUrl);

  // Build Fastify application with db wired
  const app = await buildApp({ config, db });

  // Clean up database pool on application shutdown
  app.addHook('onClose', async () => {
    await closeDb();
  });

  // Strictly bind to 127.0.0.1 at port 3001
  await app.listen({
    host: config.host,
    port: config.port
  });

  return app;
}

// Start server if this is the main module
const isMain = process.argv[1] && (
  process.argv[1].endsWith('index.ts') ||
  process.argv[1].endsWith('index.js')
);

if (isMain) {
  startServer().catch((err) => {
    console.error('Failed to start VibeHabit server:', err);
    process.exit(1);
  });
}

