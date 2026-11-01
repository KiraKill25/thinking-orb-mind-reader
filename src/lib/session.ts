/** Table play pass: the waiter's QR carries ts (unix seconds) + ttl (minutes). */
export const DEFAULT_TTL_MIN = 60;

export function sessionEnd(ts: unknown, ttl: unknown): number | null {
  const start = Number(ts);
  if (!Number.isFinite(start) || start <= 0) return null;
  const mins = Number(ttl);
  const m = Number.isFinite(mins) && mins > 0 ? Math.min(mins, 240) : DEFAULT_TTL_MIN;
  return (start + m * 60) * 1000;
}

/** Remaining ms of play; 0 when expired or no valid pass. */
export function remainingMs(ts: unknown, ttl: unknown, now = Date.now()): number {
  const end = sessionEnd(ts, ttl);
  if (end === null) return 0;
  // reject passes issued far in the future (tampered links)
  if (Number(ts) * 1000 > now + 5 * 60_000) return 0;
  return Math.max(0, end - now);
}

export const EXPIRED_MSG = "SESSION_EXPIRED";
