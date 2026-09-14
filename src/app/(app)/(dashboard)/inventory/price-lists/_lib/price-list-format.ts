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
  pending_approval: 'bg-[#fbeed8] text-[#8a4b06]',
  active: 'bg-[#d7ebe2] text-[#0b6644]',
  rejected: 'bg-[#fbdedb] text-[#b42318]',
  inactive: 'bg-[#f1f1f4] text-[#5b5b6b]',
  expired: 'bg-[#f1f1f4] text-[#5b5b6b]',
}

export const STATUS_LABELS: Record<string, string> = {
  pending_approval: 'Pending',
  active: 'Active',
  rejected: 'Rejected',
  inactive: 'Inactive',
  expired: 'Expired',
}

export function statusBadge(status: string) {
  return STATUS_BADGE_CLASS[status] ?? 'bg-[#f1f1f4] text-[#5b5b6b]'
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

// ── Redesign helpers ────────────────────────────────────────────────────
// The list page groups the five raw statuses into four plain-language
// buckets so the coverage band answers "what is actually selling right
// now?" rather than making the reader translate workflow states.

export const RETIRED_STATUSES = ['inactive', 'expired']

export type StatusTone = {
  /** Chip background + text. */
  chip: string
  /** The leading dot inside the chip. */
  dot: string
}

export const STATUS_TONES: Record<string, StatusTone> = {
  active: { chip: 'bg-[#e7f5ef] text-[#0b6644]', dot: 'bg-[#0f7b52]' },
  pending_approval: { chip: 'bg-[#fdf3e7] text-[#8a4b06]', dot: 'bg-[#d18b1d]' },
  rejected: { chip: 'bg-[#fdeceb] text-[#b42318]', dot: 'bg-[#b42318]' },
  inactive: { chip: 'bg-[#f1f1f4] text-[#5b5b6b]', dot: 'bg-[#a3a3b2]' },
  expired: { chip: 'bg-[#f1f1f4] text-[#5b5b6b]', dot: 'bg-[#a3a3b2]' },
}

export function statusTone(status: string): StatusTone {
  return STATUS_TONES[status] ?? { chip: 'bg-[#f1f1f4] text-[#5b5b6b]', dot: 'bg-[#a3a3b2]' }
}

/** Short, scannable branch scope for a table cell — the full list of names
 * is what `branchScopeLabel` is for, and it overflows badly past ~3. */
export function branchScopeShort(allowedBranchIds: string[] | undefined, totalBranches: number) {
  const n = allowedBranchIds?.length ?? 0
  if (n === 0) {
    return {
      label: 'All branches',
      note: totalBranches > 0 ? `${totalBranches} in total` : 'company-wide',
    }
  }
  return {
    label: `${n} branch${n === 1 ? '' : 'es'}`,
    note: totalBranches > 0 ? `of ${totalBranches}` : 'branch-specific',
  }
}

export function effectiveSummary(from?: string | null, to?: string | null) {
  if (!from && !to) return { label: 'Always on', note: 'no date range' }
  if (from && to) return { label: formatDate(from), note: `until ${formatDate(to)}` }
  if (from) return { label: formatDate(from), note: 'no end date' }
  return { label: 'Open start', note: `until ${formatDate(to)}` }
}

/** Share of the whole item catalog this list actually prices. Anything a
 * cashier rings up that falls outside it silently drops to the next list by
 * priority, which is the usual cause of "why did it charge that?". */
export function coverage(itemCount: number | undefined, catalogTotal: number) {
  const priced = itemCount ?? 0
  if (!catalogTotal) return { percent: null as number | null, note: 'catalog size unknown' }
  const percent = Math.round((priced / catalogTotal) * 100)
  return { percent, note: `${percent}% of ${catalogTotal.toLocaleString()} items` }
}

export const THIN_COVERAGE_THRESHOLD = 30

/** Branch names for a tooltip — capped, because a list scoped to twenty
 * branches would otherwise render a bubble wider than the screen. */
export function branchScopeTooltip(
  allowedBranchIds: string[] | undefined,
  branches: Branch[],
  max = 8
) {
  if (!allowedBranchIds || allowedBranchIds.length === 0) return 'Every branch uses this list'
  const names = branches.filter((b) => allowedBranchIds.includes(b.id)).map((b) => b.name)
  if (names.length === 0) return `${allowedBranchIds.length} branch(es)`
  const shown = names.slice(0, max).join(', ')
  return names.length > max ? `${shown} +${names.length - max} more` : shown
}
