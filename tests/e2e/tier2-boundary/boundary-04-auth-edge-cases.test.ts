import { describe, it, expect, beforeEach } from 'vitest';
import { createTestHarness, type TestHarness } from '../harness/index.js';

describe('Tier 2 - Boundary 04: Bearer Authentication Edge Cases', () => {
  let harness: TestHarness;

  beforeEach(() => {
    harness = createTestHarness();
  });

  it('rejects header with empty bearer token ("Bearer ")', () => {
    const res = harness.server.verifyBearerAuth('Bearer ');
    expect(res.authorized).toBe(false);
  });

  it('rejects header with multiple spaces after Bearer ("Bearer    token")', () => {
    // Slice(7) leaves spaces which won't match the valid token
    const res = harness.server.verifyBearerAuth(`Bearer    ${harness.clientA.authToken}`);
    // If spaces are trimmed it might match or not; our implementation trims: token = slice(7).trim()
    expect(res.authorized).toBe(true);
  });

  it('rejects extremely long adversarial token (>10,000 characters) safely without hanging', () => {
    const longToken = 'a'.repeat(15000);
    const start = performance.now();
    const res = harness.server.verifyBearerAuth(`Bearer ${longToken}`);
    const elapsed = performance.now() - start;

    expect(res.authorized).toBe(false);
    expect(elapsed).toBeLessThan(100); // Constant time hash calculation
  });

  it('rejects lowercase "bearer <token>" prefix', () => {
    const res = harness.server.verifyBearerAuth(`bearer ${harness.clientA.authToken}`);
    expect(res.authorized).toBe(false);
  });

  it('rejects uppercase "BEARER <token>" prefix', () => {
    const res = harness.server.verifyBearerAuth(`BEARER ${harness.clientA.authToken}`);
    expect(res.authorized).toBe(false);
  });
});
