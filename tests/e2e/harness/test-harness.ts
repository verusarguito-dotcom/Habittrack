import { MockServer, type ServerConfig } from './mock-server.js';
import { MockClient } from './mock-client.js';
import { resetGenerators } from './deterministic-generators.js';

export interface TestHarnessOptions {
  serverConfig?: Partial<ServerConfig>;
  seedTime?: number;
}

export class TestHarness {
  public server: MockServer;
  public clientA: MockClient;
  public clientB: MockClient;
  public clients: MockClient[];

  constructor(options: TestHarnessOptions = {}) {
    resetGenerators(options.seedTime);

    this.server = new MockServer(options.serverConfig);
    this.clientA = new MockClient('device-test-01', 'token-device-01-secret');
    this.clientB = new MockClient('device-test-02', 'token-device-02-secret');
    this.clients = [this.clientA, this.clientB];
  }

  public createClient(deviceId: string, authToken: string): MockClient {
    const client = new MockClient(deviceId, authToken);
    this.clients.push(client);
    return client;
  }

  /**
   * Set network offline for a client
   */
  public disconnectClient(client: MockClient): void {
    client.isOnline = false;
    client.updateUiSyncState('Server tidak terjangkau (Tailscale aktif?)');
  }

  /**
   * Set network online for a client
   */
  public reconnectClient(client: MockClient): void {
    client.isOnline = true;
    client.updateUiSyncState();
  }

  /**
   * Sync all online clients with the server sequentially
   */
  public async syncAll(): Promise<void> {
    for (const client of this.clients) {
      if (client.isOnline) {
        await client.sync(this.server);
      }
    }
    // Second pass to ensure pull changes propagate to all
    for (const client of this.clients) {
      if (client.isOnline) {
        await client.sync(this.server);
      }
    }
  }

  /**
   * Verifies that two clients have converged to identical state
   */
  public assertClientsConverged(client1: MockClient, client2: MockClient): void {
    // Assert 0 pending outbox mutations
    if (client1.outbox.length !== 0 || client2.outbox.length !== 0) {
      throw new Error(
        `Clients have uncommitted outbox items: Client1=${client1.outbox.length}, Client2=${client2.outbox.length}`
      );
    }

    // Assert same habit count and data
    if (client1.habits.size !== client2.habits.size) {
      throw new Error(
        `Habit size mismatch: Client1=${client1.habits.size}, Client2=${client2.habits.size}`
      );
    }

    for (const [id, habit1] of client1.habits.entries()) {
      const habit2 = client2.habits.get(id);
      if (!habit2) {
        throw new Error(`Client2 missing habit ${id}`);
      }
      if (habit1.nama !== habit2.nama || habit1.updated_at !== habit2.updated_at || habit1.deleted_at !== habit2.deleted_at) {
        throw new Error(`Habit divergence for ${id}: ${JSON.stringify(habit1)} vs ${JSON.stringify(habit2)}`);
      }
    }

    // Assert same log count and data
    if (client1.logs.size !== client2.logs.size) {
      throw new Error(
        `Logs size mismatch: Client1=${client1.logs.size}, Client2=${client2.logs.size}`
      );
    }

    for (const [id, log1] of client1.logs.entries()) {
      const log2 = client2.logs.get(id);
      if (!log2) {
        throw new Error(`Client2 missing log ${id}`);
      }
      if (log1.selesai !== log2.selesai || log1.nilai !== log2.nilai || log1.updated_at !== log2.updated_at) {
        throw new Error(`Log divergence for ${id}: ${JSON.stringify(log1)} vs ${JSON.stringify(log2)}`);
      }
    }
  }
}

export function createTestHarness(options?: TestHarnessOptions): TestHarness {
  return new TestHarness(options);
}
