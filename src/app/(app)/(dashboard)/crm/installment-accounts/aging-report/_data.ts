import { api } from '@/src/libs/api/client'
import { collectorsApi, installmentAccountsApi } from '@/src/libs/api/crm'
import { settle, type Settled } from '@/src/libs/api/unwrap'
import type { AgingReportBranchGroup, AgingReportLeanResponse } from '@/src/schema/crm/types'
import type { AgingFilters } from './_params'

// Server-side only: called from Server Components. Every function settles
// instead of throwing, so each section can render its own inline error and a
// call started without awaiting can never become an unhandled rejection.

/** Matrix + group headers for the whole filtered report (no account rows). */
export function fetchAgingSummary(
  filters: AgingFilters
): Promise<Settled<AgingReportLeanResponse>> {
  return settle(installmentAccountsApi.agingReportLean({ view: 'summary', ...filters }))
}

/**
 * One branch's rows, grouped Branch → Collector → Category. `branchId: null`
 * is the report's "Unassigned" group. The branch filter the user chose is
 * superseded: a branch section only ever shows its own rows.
 */
export async function fetchBranchDetail(
  filters: AgingFilters,
  branchId: string | null
): Promise<Settled<AgingReportBranchGroup | null>> {
  const result = await settle(
    installmentAccountsApi.agingReportLean({
      view: 'grouped',
      ...filters,
      branchId: branchId ?? 'unassigned',
    })
  )
  if (!result.ok) return result
  return { ok: true, data: result.data.branches[0] ?? null }
}

export interface AgingFilterOptions {
  branches: { id: string; name: string }[]
  collectors: { id: string; name: string; stubNumber: string; supervisorName?: string | null }[]
}

/** Options for the filter dropdowns; an empty list if a lookup fails (the report still works). */
export async function fetchFilterOptions(): Promise<AgingFilterOptions> {
  const [branches, collectors] = await Promise.all([
    settle(api.get<{ data: { id: string; name: string }[] }>('/branches', { limit: 200 })),
    settle(collectorsApi.list({ limit: 200 })),
  ])
  return {
    branches: branches.ok ? branches.data.data : [],
    collectors: collectors.ok ? collectors.data.data : [],
  }
}
