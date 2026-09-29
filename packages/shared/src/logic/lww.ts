/**
 * Last-Write-Wins (LWW) conflict resolution logic with device_id tie-breaking.
 * Pure deterministic comparison used across client outbox and server sync.
 */

export interface LwwRecord {
  updated_at: string;
  device_id: string;
}

/**
 * Compare an incoming record with an existing record using LWW rules:
 * 1. Primary: updated_at (ISO timestamp string compare).
 * 2. Secondary (tie-breaker): device_id (lexicographical string compare).
 *
 * Returns:
 *  > 0 (1)  if incoming strictly wins
 *  < 0 (-1) if incoming loses
 *  0        if incoming and existing are completely identical in timestamp and device_id (idempotent)
 */
export function compareLww(
  incoming: LwwRecord,
  existing: LwwRecord | null | undefined
): number {
  if (!existing) {
    return 1;
  }

  if (incoming.updated_at > existing.updated_at) {
    return 1;
  }
  if (incoming.updated_at < existing.updated_at) {
    return -1;
  }

  // Timestamps are identical: tie-break by device_id
  if (incoming.device_id > existing.device_id) {
    return 1;
  }
  if (incoming.device_id < existing.device_id) {
    return -1;
  }

  return 0;
}

/**
 * Convenience helper returning whether the incoming record strictly wins LWW.
 */
export function doesIncomingWinLww(
  incoming: LwwRecord,
  existing: LwwRecord | null | undefined
): boolean {
  return compareLww(incoming, existing) > 0;
}

/**
 * Resolves conflict between incoming and existing records.
 */
export function resolveLwwConflict<T extends LwwRecord>(
  incoming: T,
  existing: T | null | undefined
): { winner: T; isIncomingWinner: boolean } {
  const isIncomingWinner = doesIncomingWinLww(incoming, existing);
  return {
    winner: isIncomingWinner ? incoming : (existing ?? incoming),
    isIncomingWinner
  };
}
