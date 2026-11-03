import type { CreditApplicationOverrideSnapshot } from '@/src/schema/pos'

/** 'under_investigation' → 'Under investigation'. */
export function creditApplicationStatusLabel(status: string): string {
  const spaced = status.replace(/_/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

/** An application that has been decided — the only kind whose approved items are
 * a settled list the cart can be held against. */
export function isDecidedApplication(status: string): boolean {
  return status === 'approved' || status === 'partially_approved'
}

/**
 * Scenario 71 — a credit application override in words, one fact per line:
 * which application and what state it was in, then how it differed from the
 * sale. The same lines read on the review table, the sale, its journal entry and
 * the receipt screen.
 */
export function creditOverrideLines(o: CreditApplicationOverrideSnapshot): string[] {
  const lines = [`${o.applicationNumber} · ${creditApplicationStatusLabel(o.applicationStatus)}`]
  if (!isDecidedApplication(o.applicationStatus)) lines.push('Not approved yet')
  if (o.extra.length > 0) lines.push(`Not on the application: ${o.extra.join(', ')}`)
  if (o.missing.length > 0)
    lines.push(`On the application, not in the sale: ${o.missing.join(', ')}`)
  return lines
}
