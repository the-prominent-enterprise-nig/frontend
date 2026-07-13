'use client'

import { useState } from 'react'
import {
  X,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  RefreshCw,
  Loader2,
  Printer,
} from 'lucide-react'
import { useReceivingReports } from '../_hooks/useReceivingReports'
import type { ReceivingReport } from '@/src/schema/inventory/goods-receiving'
import { getReceivingDocument } from '../_actions/get-receiving-document'

function printDocument(data: unknown) {
  const doc = data as {
    documentType: string
    documentNumber: string
    generatedAt: string
    enterprise: {
      companyLegalName: string
      companyTradingName?: string
      registrationNumber?: string
      taxId?: string
      contactPerson?: string
    } | null
    document: Record<string, unknown>
  }

  const win = window.open('', '_blank', 'width=900,height=700')
  if (!win) return

  win.document.write(`<!DOCTYPE html><html><head><title>${doc.documentNumber}</title><style>
    body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    h2 { font-size: 14px; font-weight: 600; margin: 16px 0 8px; color: #555; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 13px; margin-bottom: 12px; }
    .label { color: #888; font-size: 11px; text-transform: uppercase; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; padding: 6px 8px; background: #f5f5f5; font-size: 11px; text-transform: uppercase; }
    td { padding: 6px 8px; border-top: 1px solid #eee; }
    .footer { margin-top: 32px; font-size: 11px; color: #999; }
    @media print { body { padding: 0; } button { display: none; } }
  </style></head><body>
    <p class="label">Goods Receipt Note</p>
    <h1>${doc.documentNumber}</h1>
    <p style="font-size:12px;color:#666">Generated: ${new Date(doc.generatedAt).toLocaleString('en-PH')}</p>
    ${
      doc.enterprise
        ? `<h2>Enterprise</h2><div class="meta">
      <div><p class="label">Company</p><p>${doc.enterprise.companyLegalName}</p></div>
      ${doc.enterprise.companyTradingName ? `<div><p class="label">Trading Name</p><p>${doc.enterprise.companyTradingName}</p></div>` : ''}
      ${doc.enterprise.registrationNumber ? `<div><p class="label">Reg. No.</p><p>${doc.enterprise.registrationNumber}</p></div>` : ''}
      ${doc.enterprise.taxId ? `<div><p class="label">Tax ID</p><p>${doc.enterprise.taxId}</p></div>` : ''}
      ${doc.enterprise.contactPerson ? `<div><p class="label">Contact</p><p>${doc.enterprise.contactPerson}</p></div>` : ''}
    </div>`
        : ''
    }
    <button onclick="window.print()" style="margin:12px 0;padding:6px 16px;background:#6d28d9;color:white;border:none;border-radius:6px;cursor:pointer;font-size:13px">Print</button>
  </body></html>`)
  win.document.close()
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

function DetailPanel({ report, onClose }: { report: ReceivingReport; onClose: () => void }) {
  const [isPrinting, setIsPrinting] = useState(false)

  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
      {/* Panel header */}
      <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-zinc-900">{report.code}</h3>
            <DiscrepancyBadge report={report} />
          </div>
          <p className="mt-0.5 text-xs text-zinc-500">
            {report.warehouse?.name ?? '—'} ·{' '}
            {new Date(report.receivedAt).toLocaleDateString('en-PH', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={async () => {
              setIsPrinting(true)
              try {
                const res = await getReceivingDocument(report.id)
                if (res.success && res.data) printDocument(res.data)
              } finally {
                setIsPrinting(false)
              }
            }}
            disabled={isPrinting}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 disabled:opacity-60"
          >
            {isPrinting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Printer className="h-3.5 w-3.5" />
            )}
            Print
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Lines */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50">
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Item
              </th>
              <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Qty Ordered
              </th>
              <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Qty Received
              </th>
              <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Variance
              </th>
              <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Condition
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden md:table-cell">
                Notes
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {report.lines.map((line) => {
              const d = line.discrepancy
              const hasIssue = d?.hasQtyDiscrepancy || d?.hasConditionIssue
              return (
                <tr key={line.id} className={hasIssue ? 'bg-red-50' : ''}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-zinc-900">{line.item?.name ?? '—'}</p>
                    {line.item?.sku && (
                      <p className="font-mono text-xs text-zinc-400">{line.item.sku}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-zinc-600">
                    {d ? d.qtyOrdered : <span className="text-zinc-400">N/A</span>}
                  </td>
                  <td className="px-4 py-3 text-center font-semibold text-zinc-800">
                    {line.quantityReceived}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {d ? (
                      <span
                        className={`font-semibold ${
                          d.qtyVariance === 0
                            ? 'text-green-700'
                            : d.qtyVariance > 0
                              ? 'text-amber-600'
                              : 'text-red-600'
                        }`}
                      >
                        {d.qtyVariance > 0 ? `+${d.qtyVariance}` : d.qtyVariance}
                      </span>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {line.qualityHold ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                        <AlertTriangle className="h-3 w-3" />
                        QC Hold
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                        <CheckCircle2 className="h-3 w-3" />
                        OK
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-500 hidden md:table-cell max-w-xs truncate">
                    {line.notes ?? '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function ReceivingReportsTab() {
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
    selectedId,
    setSelectedId,
    selectedReport,
    isLoadingDetail,
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
                    GRN Code
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden sm:table-cell">
                    Warehouse
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden lg:table-cell">
                    Branch
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden md:table-cell">
                    Lines
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden md:table-cell">
                    Received
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Status
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {reports.map((report) => (
                  <tr
                    key={report.id}
                    className={`cursor-pointer hover:bg-zinc-50 ${selectedId === report.id ? 'bg-prominent-purple-50' : ''}`}
                    onClick={() => setSelectedId(selectedId === report.id ? undefined : report.id)}
                  >
                    <td className="px-4 py-3 font-mono font-medium text-zinc-900">{report.code}</td>
                    <td className="px-4 py-3 text-zinc-600 hidden sm:table-cell">
                      {report.warehouse?.code ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 hidden lg:table-cell">
                      {report.warehouse?.branch?.name ?? '—'}
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
                    <td className="px-4 py-3 text-center">
                      <DiscrepancyBadge report={report} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ChevronRight
                        className={`h-4 w-4 transition-transform ${selectedId === report.id ? 'rotate-90 text-prominent-purple-700' : 'text-zinc-400'}`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail panel */}
      {selectedId && (
        <div>
          {isLoadingDetail ? (
            <div className="flex items-center justify-center rounded-xl border border-zinc-200 bg-white py-12">
              <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
            </div>
          ) : selectedReport ? (
            <DetailPanel report={selectedReport} onClose={() => setSelectedId(undefined)} />
          ) : null}
        </div>
      )}

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
