import Link from 'next/link'
import { Upload } from 'lucide-react'
import ExportButton from '@/src/components/common/ExportButton'
import type { Settled } from '@/src/libs/api/unwrap'
import type { AgingReportLeanResponse } from '@/src/schema/crm/types'
import type { AgingFilters } from '../_params'
import { PrintButton } from './PrintButton'

/**
 * Export and Print are only useful once there is something to export, so they
 * wait for the same summary the report body uses (already in flight — no extra
 * request) and stay disabled until it shows rows.
 */
export async function AgingActions({
  summary,
  filters,
  canLoad,
}: {
  summary: Promise<Settled<AgingReportLeanResponse>>
  filters: AgingFilters
  /** Whether this login may load the aging sheet. */
  canLoad: boolean
}): Promise<React.JSX.Element> {
  const result = await summary
  const empty = !result.ok || result.data.branches.length === 0

  return (
    <div className="flex items-center gap-2">
      {canLoad && (
        <Link
          href="/crm/installment-accounts/load-aging"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          <Upload className="h-4 w-4" />
          Load aging sheet
        </Link>
      )}
      <ExportButton
        endpoint="/crm/installment-accounts/reports/aging/export"
        params={{
          asOf: filters.asOf,
          branchId: filters.branchId,
          collectorId: filters.collectorId,
          supervisorName: filters.supervisorName,
        }}
        disabled={empty}
      />
      <PrintButton filters={filters} disabled={empty} />
    </div>
  )
}
