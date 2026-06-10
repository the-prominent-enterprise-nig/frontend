export const STALE = {
  REALTIME: 30_000,
  OPERATIONAL: 2 * 60_000,
  LOOKUP: 5 * 60_000,
  REFERENCE: 10 * 60_000,
  STATIC: Infinity,
} as const
