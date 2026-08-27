'use client'

import { AlertOctagon, PackageSearch, Truck, ClipboardList, X } from 'lucide-react'
import type { ReconciliationReportResponse } from '@/src/schema/inventory/reports'

interface Props {
  data: ReconciliationReportResponse | null | undefined
  isLoading: boolean
  isFetching: boolean
  startDate: string | undefined
  endDate: string | undefined
  setStartDate: (v: string | undefined) => void
  setEndDate: (v: string | undefined) => void
}

function EmptySection({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <p className="text-sm font-medium text-green-700">No {label} found in this range</p>
    </div>
  )
}

function SectionCard({
  icon,
  title,
  description,
  count,
  children,
}: {
  icon: React.ReactNode
  title: string
  description: string
  count: number
  children: React.ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
        <div className="flex items-center gap-3">
          {icon}
          <div>
            <h3 className="text-sm font-semibold text-prominent-purple-900">{title}</h3>
            <p className="text-xs text-zinc-500">{description}</p>
          </div>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-bold ${
            count > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
          }`}
        >
          {count}
        </span>
      </div>
      {children}
    </div>
  )
}

export default function ReconciliationReport({
  data,
  isLoading,
  isFetching,
  startDate,
  endDate,
  setStartDate,
  setEndDate,
}: Props) {
  const hasDateFilter = !!startDate || !!endDate

  return (
    <div className="space-y-6">
      {/* Date range */}
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="recon-start-date" className="text-sm font-medium text-zinc-600">
          From
        </label>
        <input
          id="recon-start-date"
          type="date"
          value={startDate ?? ''}
          onChange={(e) => setStartDate(e.target.value || undefined)}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500"
        />
        <label htmlFor="recon-end-date" className="text-sm font-medium text-zinc-600">
          To
        </label>
        <input
          id="recon-end-date"
          type="date"
          value={endDate ?? ''}
          onChange={(e) => setEndDate(e.target.value || undefined)}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500"
        />
        {hasDateFilter && (
          <button
            type="button"
            onClick={() => {
              setStartDate(undefined)
              setEndDate(undefined)
            }}
            className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-100"
          >
            <X className="h-4 w-4" />
            Clear
          </button>
        )}
        {data?.dateRange && (
          <p className="text-xs text-zinc-400">
            Showing {new Date(data.dateRange.startDate).toLocaleDateString('en-PH')} –{' '}
            {new Date(data.dateRange.endDate).toLocaleDateString('en-PH')}
          </p>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-zinc-100" />
          ))}
        </div>
      ) : (
        <div className={`space-y-4 transition-opacity ${isFetching ? 'opacity-60' : ''}`}>
          {/* 1. Null-reference ledger rows */}
          <SectionCard
            icon={<AlertOctagon className="h-5 w-5 text-red-500" />}
            title="Movements with no source reference"
            description="StockLedger rows that can't be traced back to the document that caused them"
            count={data?.nullReference.count ?? 0}
          >
            {!data?.nullReference.sample.length ? (
              <EmptySection label="unreferenced movements" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      <th className="px-4 py-2">Item</th>
                      <th className="px-4 py-2">Location</th>
                      <th className="px-4 py-2">Type</th>
                      <th className="px-4 py-2 text-right">Qty Change</th>
                      <th className="px-4 py-2">Reference</th>
                      <th className="px-4 py-2">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {data.nullReference.sample.map((r) => (
                      <tr key={r.stockLedgerId}>
                        <td className="px-4 py-2">
                          <p className="font-medium text-zinc-800">{r.itemName}</p>
                          <p className="font-mono text-xs text-zinc-400">{r.sku}</p>
                        </td>
                        <td className="px-4 py-2 text-zinc-600">{r.warehouseName}</td>
                        <td className="px-4 py-2 text-zinc-600">{r.transactionType}</td>
                        <td className="px-4 py-2 text-right text-zinc-600">{r.quantityChange}</td>
                        <td className="px-4 py-2 text-zinc-500">
                          {r.referenceType ?? '—'} / {r.referenceId ?? '—'}
                        </td>
                        <td className="px-4 py-2 text-zinc-500">
                          {new Date(r.occurredAt).toLocaleDateString('en-PH')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          {/* 2. Missing POS movements */}
          <SectionCard
            icon={<PackageSearch className="h-5 w-5 text-red-500" />}
            title="POS sales with no stock movement"
            description="Completed sales that should have deducted stock but have no matching ledger entry"
            count={data?.missingPosMovements.count ?? 0}
          >
            {!data?.missingPosMovements.sample.length ? (
              <EmptySection label="unmatched sales" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      <th className="px-4 py-2">Transaction</th>
                      <th className="px-4 py-2">Type</th>
                      <th className="px-4 py-2">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {data.missingPosMovements.sample.map((t) => (
                      <tr key={t.transactionId}>
                        <td className="px-4 py-2 font-mono text-xs text-zinc-700">
                          {t.transactionNumber}
                        </td>
                        <td className="px-4 py-2 text-zinc-600">{t.transactionType}</td>
                        <td className="px-4 py-2 text-zinc-500">
                          {new Date(t.occurredAt).toLocaleDateString('en-PH')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          {/* 3. Missing transfer movements */}
          <SectionCard
            icon={<Truck className="h-5 w-5 text-red-500" />}
            title="Transfers with no stock movement"
            description="Dispatched transfers that should have moved stock but have no matching ledger entry"
            count={data?.missingTransferMovements.count ?? 0}
          >
            {!data?.missingTransferMovements.sample.length ? (
              <EmptySection label="unmatched transfers" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      <th className="px-4 py-2">Transfer</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2">Route</th>
                      <th className="px-4 py-2">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {data.missingTransferMovements.sample.map((t) => (
                      <tr key={t.transferId}>
                        <td className="px-4 py-2 font-mono text-xs text-zinc-700">
                          {t.transferNumber}
                        </td>
                        <td className="px-4 py-2 text-zinc-600">{t.status}</td>
                        <td className="px-4 py-2 text-zinc-600">
                          {t.fromWarehouseName} → {t.toWarehouseName}
                        </td>
                        <td className="px-4 py-2 text-zinc-500">
                          {new Date(t.transferDate).toLocaleDateString('en-PH')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          {/* 4. Missing adjustment movements */}
          <SectionCard
            icon={<ClipboardList className="h-5 w-5 text-red-500" />}
            title="Adjustments with no stock movement"
            description="Approved adjustments with a real quantity change but no matching ledger entry"
            count={data?.missingAdjustmentMovements.count ?? 0}
          >
            {!data?.missingAdjustmentMovements.sample.length ? (
              <EmptySection label="unmatched adjustments" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      <th className="px-4 py-2">Adjustment</th>
                      <th className="px-4 py-2">Reason</th>
                      <th className="px-4 py-2">Location</th>
                      <th className="px-4 py-2">Approved</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {data.missingAdjustmentMovements.sample.map((a) => (
                      <tr key={a.adjustmentId}>
                        <td className="px-4 py-2 font-mono text-xs text-zinc-700">
                          {a.adjustmentNumber}
                        </td>
                        <td className="px-4 py-2 text-zinc-600">{a.reasonCode}</td>
                        <td className="px-4 py-2 text-zinc-600">{a.warehouseName}</td>
                        <td className="px-4 py-2 text-zinc-500">
                          {a.approvedAt ? new Date(a.approvedAt).toLocaleDateString('en-PH') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>
      )}
    </div>
  )
}
