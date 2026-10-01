import { describe, it, expect } from 'vitest';
import { validateServerConfig } from '../harness/index.js';

describe('Tier 2 - Boundary 03: Environment Edge Cases', () => {
  it('rejects connection string containing only whitespace', () => {
    expect(() => {
      validateServerConfig({
        databaseUrl: '    ',
        deviceTokens: { d1: 'hash' }
      });
    }).toThrow(/DATABASE_URL is required/);
  });

  it('rejects unsupported database schemes (e.g., sqlite or mongodb)', () => {
    expect(() => {
      validateServerConfig({
        databaseUrl: 'sqlite://file.db',
        deviceTokens: { d1: 'hash' }
      });
    }).toThrow(/valid PostgreSQL connection string/);
  });

  it('rejects binding to external network interfaces like 0.0.0.0', () => {
    expect(() => {
      validateServerConfig({
        databaseUrl: 'postgres://localhost/test',
        deviceTokens: { d1: 'hash' },
        host: '0.0.0.0'
      });
    }).toThrow(/strictly bind to 127.0.0.1/);
  });

  it('rejects binding to remote IP addresses like 192.168.1.100', () => {
    expect(() => {
      validateServerConfig({
        databaseUrl: 'postgres://localhost/test',
        deviceTokens: { d1: 'hash' },
        host: '192.168.1.100'
      });
    }).toThrow(/strictly bind to 127.0.0.1/);
  });

  it('accepts valid postgres:// and postgresql:// URL prefixes', () => {
    const c1 = validateServerConfig({
      databaseUrl: 'postgres://user:pass@127.0.0.1:5432/vibehabit',
      deviceTokens: { d1: 'hash' }
    });
    const c2 = validateServerConfig({
      databaseUrl: 'postgresql://user:pass@127.0.0.1:5432/vibehabit',
      deviceTokens: { d1: 'hash' }
    });
    expect(c1.databaseUrl).toBeDefined();
    expect(c2.databaseUrl).toBeDefined();
  });
});
