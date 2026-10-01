import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { validateServerConfig } from '../../../apps/server/src/config.js';

describe('T017: VPS Deployment Artifacts & Disaster Recovery (ARCH §4, §7, §8, §9)', () => {
  const deployDir = path.resolve('deploy');

  describe('Containerfile & Dockerfile Multi-Stage Build', () => {
    it('verifies Containerfile and Dockerfile exist and define multi-stage Node 22 alpine build', () => {
      const containerfilePath = path.join(deployDir, 'Containerfile');
      const dockerfilePath = path.join(deployDir, 'Dockerfile');

      expect(fs.existsSync(containerfilePath)).toBe(true);
      expect(fs.existsSync(dockerfilePath)).toBe(true);

      const content = fs.readFileSync(containerfilePath, 'utf-8');
      expect(content).toContain('FROM node:22-alpine AS builder');
      expect(content).toContain('FROM node:22-alpine AS runner');
      expect(content).toContain('USER node');
      expect(content).toContain('EXPOSE 3001');
      expect(content).toContain('127.0.0.1:3001/api/v1/health');
      expect(content).toContain('--experimental-strip-types');
    });
  });

  describe('Podman & Docker Compose Configurations', () => {
    it('verifies compose files strictly bind app to 127.0.0.1:3001 and isolate database', () => {
      const podmanComposePath = path.join(deployDir, 'podman-compose.yml');
      const dockerComposePath = path.join(deployDir, 'docker-compose.yml');

      expect(fs.existsSync(podmanComposePath)).toBe(true);
      expect(fs.existsSync(dockerComposePath)).toBe(true);

      const content = fs.readFileSync(podmanComposePath, 'utf-8');
      expect(content).toContain('"127.0.0.1:3001:3001"');
      expect(content).not.toContain('"0.0.0.0:3001:3001"');
      expect(content).not.toContain('"3001:3001"');

      // Database port 5432 must NOT be published to host
      expect(content).not.toContain('"5432:5432"');
      expect(content).not.toContain('"127.0.0.1:5432:5432"');

      // Named volume for PostgreSQL
      expect(content).toContain('pgdata:/var/lib/postgresql/data');
      expect(content).toContain('pgdata:');
      expect(content).toContain('postgres:16-alpine');
    });
  });

  describe('Automated Backup Script (backup.sh)', () => {
    it('verifies backup.sh contains strict error handling, gzip compression, and rotation', () => {
      const backupPath = path.join(deployDir, 'backup.sh');
      expect(fs.existsSync(backupPath)).toBe(true);

      const content = fs.readFileSync(backupPath, 'utf-8');
      expect(content).toMatch(/^#!/);
      expect(content).toContain('set -euo pipefail');
      expect(content).toContain('pg_dump');
      expect(content).toContain('gzip -9');
      expect(content).toContain('gzip -t');
      expect(content).toContain('RETENTION_DAYS');
      expect(content).toContain('-delete');
    });
  });

  describe('Production Environment Template (.env.example)', () => {
    it('strictly follows NAMA=nilai format and cleanly validates against serverConfigSchema', () => {
      const envExamplePath = path.join(deployDir, '.env.example');
      expect(fs.existsSync(envExamplePath)).toBe(true);

      const content = fs.readFileSync(envExamplePath, 'utf-8');
      const lines = content.split(/\r?\n/).filter(Boolean);

      const parsedEnv: Record<string, string> = {};
      for (const line of lines) {
        // Must strictly not start with comment or contain quotes
        expect(line.startsWith('#')).toBe(false);
        expect(line).not.toContain('"');
        expect(line).not.toContain("'");

        const [k, ...v] = line.split('=');
        expect(k).toBeDefined();
        parsedEnv[k!.trim()] = v.join('=').trim();
      }

      // Must cleanly validate against server schema without error
      const validated = validateServerConfig(parsedEnv);
      expect(validated.host).toBe('127.0.0.1');
      expect(validated.port).toBe(3001);
      expect(validated.databaseUrl).toContain('postgresql://');
      expect(Object.keys(validated.deviceTokens).length).toBeGreaterThan(0);
    });
  });

  describe('Operational README.md Manual', () => {
    it('documents Tailscale Serve :8443, JobFlow isolation, migrations, and disaster recovery', () => {
      const readmePath = path.join(deployDir, 'README.md');
      expect(fs.existsSync(readmePath)).toBe(true);

      const content = fs.readFileSync(readmePath, 'utf-8');
      expect(content).toContain(':8443');
      expect(content).toContain('JobFlow');
      expect(content).toContain('tailscale serve');
      expect(content).toContain('001_init.sql');
      expect(content).toContain('backup.sh');
      expect(content).toContain('Disaster Recovery');
      expect(content).toContain('gzip -t');
    });
  });
});
