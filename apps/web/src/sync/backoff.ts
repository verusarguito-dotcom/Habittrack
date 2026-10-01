/**
 * Calculates exponential backoff with jitter (2s–60s) (PRD §8.2 & ARCHITECTURE §6.4).
 * Base: 2000ms.
 * Max: 60000ms.
 * Jitter: non-negative random perturbation.
 */
export function calculateBackoffMs(
  attempt: number,
  randomJitterRatio = Math.random() * 0.1
): number {
  const baseMs = 2000;
  const maxMs = 60000;
  const expMs = Math.min(maxMs, baseMs * Math.pow(2, attempt));
  const jitter = expMs * Math.max(0, randomJitterRatio);
  return Math.floor(expMs + jitter);
}
