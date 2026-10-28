import type { QueryClient } from '@tanstack/react-query'
import { ARInvoices, type ARInvoiceDashboardStats } from '@/src/libs/data/AccountingV2Data'
import { arStatsKey } from './dashboardQueryKeys'
import { getSession } from '@/src/libs/auth/actions'
import { hasPermission } from '@/src/hooks/usePermission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'

/** What the tiles show when the stats request fails — the same zeros an empty invoice list gave. */
const EMPTY_AR_STATS: ARInvoiceDashboardStats = {
  invoiceCount: 0,
  outstanding: 0,
  open: { count: 0, outstanding: 0 },
  overdue: { count: 0, outstanding: 0, oldestDueDate: null, top: [] },
  outstandingTop: [],
  recent: [],
}

/**
 * The dashboard's AR figures (outstanding, overdue, the few rows the widgets
 * list), summed on the server over every invoice — a few KB, where the
 * widgets used to each download the whole invoice list (4.8 MB on the dev
 * data, fetched twice per visit) to add it up themselves.
 */
export async function loadArStats(branchId?: string): Promise<ARInvoiceDashboardStats> {
  // A role without AR (Access Levels: Stock Controller, Marketing Manager)
  // isn't asked for it: the server would only refuse. Its tiles read empty,
  // as on a failed request.
  const session = await getSession()
  if (!session || !hasPermission(session, ACCOUNTING_PERMISSIONS.AR_INVOICES_READ)) {
    return EMPTY_AR_STATS
  }
  const res = await ARInvoices.dashboardStats({ branchId })
  return res.data ?? EMPTY_AR_STATS
}

/**
 * For callers that aren't a component (the module stats, the branch customer
 * count, the widgets that load in an effect): goes through the same cache key
 * as `useDashboardArStats`, so whoever asks first fires the request and the
 * rest reuse it. Every reader of the key goes through `loadArStats`, so they
 * all get the same shape — two readers once cached different shapes under one
 * key, and one of them silently read an empty list.
 */
export function fetchArStats(queryClient: QueryClient, branchId?: string) {
  return queryClient.fetchQuery({
    queryKey: arStatsKey(branchId),
    queryFn: () => loadArStats(branchId),
  })
}
