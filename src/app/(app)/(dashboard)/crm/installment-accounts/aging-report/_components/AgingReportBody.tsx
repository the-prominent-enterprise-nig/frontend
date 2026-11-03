import type { Settled } from '@/src/libs/api/unwrap'
import { SectionError } from '@/src/components/ssr/SectionError'
import { UrlPagination } from '@/src/components/ssr/UrlPagination'
import { weightedPageInfo, weightedPages } from '@/src/components/ssr/paginate'
import type { AgingReportLeanResponse } from '@/src/schema/crm/types'
import {
  MAX_BRANCHES_PER_PAGE,
  ROWS_PER_PAGE_BUDGET,
  agingFilters,
  type AgingParams,
} from '../_params'
import { fmt } from '../_format'
import { AgingMatrix } from './AgingMatrix'
import { BranchSection } from './BranchSection'

/**
 * The report. Awaits only the summary (a ~120 KB call) to paint the matrix, the
 * branch headers and the totals; every branch's account rows then stream in
 * independently inside BranchSection. Branch sections are the unit of paging —
 * each carries its own collector tables, so paging rows would split a branch
 * across pages — and pages are packed by row count (see ROWS_PER_PAGE_BUDGET).
 */
export async function AgingReportBody({
  summary,
  params,
}: {
  summary: Promise<Settled<AgingReportLeanResponse>>
  params: AgingParams
}): Promise<React.JSX.Element> {
  const result = await summary
  if (!result.ok)
    return <SectionError message={`Could not load the aging report: ${result.error}`} />

  const report = result.data
  if (report.branches.length === 0) {
    return (
      <p className="rounded-xl border border-gray-200 bg-white px-4 py-6 text-center text-sm text-gray-500">
        No active accounts to show.
      </p>
    )
  }

  const pages = weightedPages(
    report.branches,
    (b) => b.subtotal.count,
    ROWS_PER_PAGE_BUDGET,
    MAX_BRANCHES_PER_PAGE
  )
  const info = weightedPageInfo(pages, params.page)
  const pagedBranches = pages[info.page - 1] ?? []
  const filters = agingFilters(params)

  return (
    <div className="space-y-6">
      <AgingMatrix report={report} />

      {pagedBranches.map((branch) => (
        <BranchSection
          key={branch.branchId ?? 'unassigned'}
          branch={branch}
          filters={filters}
          hasInstallmentRows={report.hasInstallmentRows}
        />
      ))}

      <UrlPagination info={info} noun="branch" />

      <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700">
        Grand Total ({report.grandTotal.count} accounts): TOTAL PAY&apos;T{' '}
        {fmt(report.grandTotal.totalPayt)} · TOTAL PRICE {fmt(report.grandTotal.totalPrice)} · OB{' '}
        {fmt(report.grandTotal.ob)}
      </div>
    </div>
  )
}
