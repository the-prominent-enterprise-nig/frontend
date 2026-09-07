'use client'

import { useRouter } from 'next/navigation'
import { X, AlertTriangle, CheckCircle2, ChevronRight, RefreshCw } from 'lucide-react'
import { useReceivingReports } from '../_hooks/useReceivingReports'
import type { ReceivingReport } from '@/src/schema/inventory/goods-receiving'

const fmtMoney = (n: number) =>
  n.toLocaleString('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 2 })

// A line's cost is only meaningful when someone actually entered it — a
// freebie or a receipt with no cost-view access carries unitCost 0/null,
// which must read as "no cost recorded", not "this cost is zero".
function lineAmount(line: ReceivingReport['lines'][number]): number | null {
  if (line.unitCost == null) return null
  return line.quantityReceived * line.unitCost
}

function reportAmount(report: ReceivingReport): number | null {
  const amounts = report.lines.map(lineAmount).filter((a): a is number => a != null)
  return amounts.length > 0 ? amounts.reduce((sum, a) => sum + a, 0) : null
}

// The real linked PO's code (when this receipt came from Receive Against
// PO) — falls back to the free-text purchaseOrderNumber field for receipts
// entered through the standalone Receive Stock form with no PO link.
function reportPoCode(report: ReceivingReport): string | null {
  for (const line of report.lines) {
    const code = line.purchaseOrderLine?.purchaseOrder?.code
    if (code) return code
  }
  return null
}

function DiscrepancyBadge({ report }: { report: ReceivingReport }) {
  if (!report.hasAnyDiscrepancy) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
        <CheckCircle2 className="h-3 w-3" />
        OK
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
      <AlertTriangle className="h-3 w-3" />
      Discrepancy
    </span>
  )
}

type Props = {
  // Amounts are financial info (unit cost / total cost) — shown for
  // Accounting's own Receiving Reports view, hidden for Inventory's
  // (warehouse/receiving staff don't need supplier cost visibility here).
  showAmounts?: boolean
  /** Where a row opens. This list is rendered by both Inventory and
   * Accounting; a click should keep you inside whichever module you came from,
   * rather than flinging an Accounting user into Inventory. */
  detailBasePath?: string
}

export default function ReceivingReportsTab({
  showAmounts = false,
  detailBasePath = '/inventory/goods-receiving',
}: Props) {
  const router = useRouter()
  const {
    reports,
    meta,
    page,
    totalPages,
    isLoading,
    isFetching,
    warehouseId,
    hasDiscrepancy,
    startDate,
    endDate,
    setWarehouseId,
    setHasDiscrepancy,
    setStartDate,
    setEndDate,
    resetFilters,
    setPage,
  } = useReceivingReports()

  const hasFilters = warehouseId || hasDiscrepancy !== undefined || startDate || endDate

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={hasDiscrepancy === undefined ? '' : hasDiscrepancy ? 'true' : 'false'}
          onChange={(e) => {
            if (e.target.value === '') setHasDiscrepancy(undefined)
            else setHasDiscrepancy(e.target.value === 'true')
          }}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500"
        >
          <option value="">All Receipts</option>
          <option value="true">Discrepancies Only</option>
          <option value="false">No Discrepancies</option>
        </select>

        <input
          type="date"
          value={startDate ?? ''}
          onChange={(e) => setStartDate(e.target.value || undefined)}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500"
        />
        <span className="text-xs text-zinc-400">to</span>
        <input
          type="date"
          value={endDate ?? ''}
          onChange={(e) => setEndDate(e.target.value || undefined)}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500"
        />

        {hasFilters && (
          <button
            type="button"
            onClick={resetFilters}
            className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-100"
          >
            <X className="h-4 w-4" /> Clear
          </button>
        )}

        {isFetching && !isLoading && <RefreshCw className="h-4 w-4 animate-spin text-zinc-400" />}
      </div>

      {/* Table */}
      <div
        className={`overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-opacity ${isFetching ? 'opacity-60' : ''}`}
      >
        {isLoading ? (
          <div className="divide-y divide-zinc-100">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <div className="h-4 w-24 animate-pulse rounded bg-zinc-200" />
                <div className="h-4 w-40 animate-pulse rounded bg-zinc-200" />
                <div className="ml-auto h-5 w-24 animate-pulse rounded-full bg-zinc-200" />
              </div>
            ))}
          </div>
        ) : reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <p className="text-sm font-medium text-zinc-500">No receiving reports found</p>
            <p className="mt-1 text-xs text-zinc-400">Receive stock to generate reports here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Receiving Report No.
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden sm:table-cell">
                    PO Reference
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden sm:table-cell">
                    Location
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden md:table-cell">
                    Lines
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden md:table-cell">
                    Received
                  </th>
                  {showAmounts && (
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Amount
                    </th>
                  )}
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Status
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {reports.map((report) => {
                  return (
                    <tr
                      key={report.id}
                      className="cursor-pointer hover:bg-zinc-50"
                      onClick={() => router.push(`${detailBasePath}/${report.id}`)}
                    >
                      <td className="px-4 py-3 font-mono font-medium text-zinc-900">
                        {report.code}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        {(reportPoCode(report) ?? report.purchaseOrderNumber) ? (
                          <span className="font-mono text-zinc-600">
                            {reportPoCode(report) ?? report.purchaseOrderNumber}
                          </span>
                        ) : (
                          <span className="text-zinc-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-600 hidden sm:table-cell">
                        {report.warehouse?.branch?.name ?? report.warehouse?.name ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-center text-zinc-500 hidden md:table-cell">
                        {report.lines.length}
                      </td>
                      <td className="px-4 py-3 text-zinc-500 hidden md:table-cell">
                        {new Date(report.receivedAt).toLocaleDateString('en-PH', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                      {showAmounts && (
                        <td className="px-4 py-3 text-right text-zinc-700">
                          {(() => {
                            const amount = reportAmount(report)
                            return amount != null ? (
                              fmtMoney(amount)
                            ) : (
                              <span className="text-zinc-400">—</span>
                            )
                          })()}
                        </td>
                      )}
                      <td className="px-4 py-3 text-center">
                        <DiscrepancyBadge report={report} />
                      </td>
                      {/* Scenario 46 — the inline expansion is gone. A row now
                          opens the receiving report's own page, which shows the
                          document as it prints (the same sheet the Accounting
                          screen uses) with the ordered/variance/QC detail
                          beside it. A data table inside a row was a different
                          thing from the paper it represents. */}
                      <td className="px-4 py-3 text-right">
                        <ChevronRight className="h-4 w-4 text-zinc-400" />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-zinc-500">
          <span>{meta?.total ?? 0} receipts</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="rounded-lg px-3 py-1.5 hover:bg-zinc-100 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="px-3 py-1.5 font-medium text-zinc-700">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              className="rounded-lg px-3 py-1.5 hover:bg-zinc-100 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
