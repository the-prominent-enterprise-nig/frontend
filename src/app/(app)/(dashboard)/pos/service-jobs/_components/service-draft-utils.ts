import type { ServiceDraft } from '@/src/schema/pos/service-drafts'

// Shared between ServiceJobsList's table row and ServiceJobDetailModal's
// summary panel.
export function customerDisplayName(
  customer: NonNullable<ServiceDraft['customer']> | null | undefined
): string {
  if (!customer) return '—'
  return customer.name || `${customer.firstName ?? ''} ${customer.lastName ?? ''}`.trim() || '—'
}
