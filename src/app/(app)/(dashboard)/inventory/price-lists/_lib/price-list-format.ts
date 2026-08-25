import type { Branch } from '../_actions/get-branches'

// Editing an 'active' list is allowed too — it drops back to
// pending_approval on save (see the backend's revertToPendingIfActive) so
// the change can't reach checkout without a fresh approval. Only genuinely
// retired statuses (inactive, expired) stay locked.
export const EDITABLE_STATUSES = ['pending_approval', 'rejected', 'active']
// Deleting an already-retired list is a no-op from the user's perspective —
// only offer it for lists that are actually still "live" in some sense.
export const DELETABLE_STATUSES = ['pending_approval', 'rejected', 'active']

export const STATUS_BADGE_CLASS: Record<string, string> = {
  pending_approval: 'bg-amber-100 text-amber-700',
  active: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  inactive: 'bg-zinc-100 text-zinc-500',
  expired: 'bg-zinc-100 text-zinc-500',
}

export const STATUS_LABELS: Record<string, string> = {
  pending_approval: 'Pending',
  active: 'Active',
  rejected: 'Rejected',
  inactive: 'Inactive',
  expired: 'Expired',
}

export function statusBadge(status: string) {
  return STATUS_BADGE_CLASS[status] ?? 'bg-zinc-100 text-zinc-500'
}

export function itemCountLabel(itemCount: number | undefined) {
  const n = itemCount ?? 0
  return `${n} item${n === 1 ? '' : 's'} priced`
}

export function branchScopeLabel(allowedBranchIds: string[] | undefined, branches: Branch[]) {
  if (!allowedBranchIds || allowedBranchIds.length === 0) return 'All branches'
  const names = branches.filter((b) => allowedBranchIds.includes(b.id)).map((b) => b.name)
  if (names.length === 0) return `${allowedBranchIds.length} branch(es)`
  return names.join(', ')
}

export function formatDate(date?: string | null) {
  if (!date) return '—'
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString()
}

export function formatEffectiveRange(from?: string | null, to?: string | null) {
  if (!from && !to) return 'No date range'
  return `${formatDate(from)} – ${formatDate(to)}`
}
