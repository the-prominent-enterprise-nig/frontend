/**
 * Validates a `returnTo` query param before it reaches router.push().
 *
 * Only same-origin absolute paths are honoured. A raw query param pushed
 * straight into the router is an open redirect: '//evil.com' and
 * 'https://evil.com' are both valid push targets, and some browsers
 * normalise backslashes to '/', so those shapes are rejected outright
 * rather than sanitised.
 *
 * Shared by every page that accepts one — POS checkout's "New Customer"
 * detour, the POS and CRM customer forms — so the rule cannot drift
 * between copies.
 */
export function safeReturnTo(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined
  if (!raw.startsWith('/')) return undefined
  if (raw.startsWith('//')) return undefined
  if (raw.includes(BACKSLASH)) return undefined
  return raw
}

const BACKSLASH = String.fromCharCode(92)
