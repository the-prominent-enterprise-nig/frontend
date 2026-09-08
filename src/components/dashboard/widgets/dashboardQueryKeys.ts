// Centralised React Query key builders for dashboard data that more than
// one widget needs. Widgets that build the exact same key for the exact
// same underlying request (e.g. the KPI strip's "Outstanding AR" tile and
// the Needs Attention feed both wanting this branch's AR invoices) share
// one cached/in-flight request instead of each firing its own — React
// Query dedupes concurrent fetches by key, not by call site.

export function arInvoicesKey(branchId?: string) {
  return ['dashboard', 'ar-invoices', branchId ?? 'all'] as const
}

export function salesByBranchKey(dateFrom?: string) {
  return ['dashboard', 'sales-by-branch', dateFrom ?? 'all'] as const
}

export function needsAttentionKey(branchId?: string) {
  return ['dashboard', 'needs-attention', branchId ?? 'all'] as const
}
