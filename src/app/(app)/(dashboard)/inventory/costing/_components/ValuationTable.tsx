'use client'

import { RefreshCw, TrendingUp } from 'lucide-react'
import { COSTING_METHOD_LABELS, type ValuationResponse } from '@/src/schema/inventory/costing'

const METHOD_BADGE: Record<string, string> = {
  fifo: 'bg-blue-100 text-blue-700',
  lifo: 'bg-orange-100 text-orange-700',
  weighted_average: 'bg-green-100 text-green-700',
}

function fmt(n: number) {
  return n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

interface Props {
  valuation: ValuationResponse | null
  isLoading: boolean
  isFetching: boolean
  warehouseFilter?: string
  warehouseOptions: { id: string; code: string; name: string }[]
  onWarehouseChange: (id: string | undefined) => void
  onRefresh: () => void
}

export default function ValuationTable({
  valuation,
  isLoading,
  isFetching,
  warehouseFilter,
  warehouseOptions,
  onWarehouseChange,
  onRefresh,
}: Props) {
  const items = valuation?.items ?? []

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={warehouseFilter ?? ''}
          onChange={(e) => onWarehouseChange(e.target.value || undefined)}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500"
        >
          <option value="">All Warehouses</option>
          {warehouseOptions.map((w) => (
            <option key={w.id} value={w.id}>
              {w.code} — {w.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isFetching}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-prominent-purple-700 hover:bg-prominent-purple-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Grand total chip */}
      {valuation && (
        <div className="flex items-center gap-2 rounded-lg border border-prominent-purple-100 bg-prominent-purple-50 px-4 py-2.5">
          <TrendingUp className="h-4 w-4 text-prominent-purple-600" />
          <span className="text-sm text-prominent-purple-700">
            Total Inventory Value:{' '}
            <strong className="text-prominent-purple-900">₱{fmt(valuation.grandTotal)}</strong>
          </span>
        </div>
      )}

      {valuation?.note && <p className="text-xs text-zinc-400 italic">{valuation.note}</p>}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-100 bg-zinc-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-zinc-500">SKU</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-500">Item</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-500">Warehouse</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-500">Method</th>
              <th className="px-4 py-3 text-right font-medium text-zinc-500">On-Hand Qty</th>
              <th className="px-4 py-3 text-right font-medium text-zinc-500">Avg Unit Cost</th>
              <th className="px-4 py-3 text-right font-medium text-zinc-500">Total Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 animate-pulse rounded bg-zinc-100" />
                    </td>
                  ))}
                </tr>
              ))
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-zinc-400">
                  No cost-layer data found. Receive stock with a unit cost to populate this report.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={`${item.itemId}:${item.warehouseId}`} className="hover:bg-zinc-50">
                  <td className="px-4 py-3 font-mono text-xs text-zinc-500">{item.sku}</td>
                  <td className="px-4 py-3 font-medium text-zinc-800">{item.name}</td>
                  <td className="px-4 py-3 text-sm text-zinc-600">
                    {item.warehouseCode} — {item.warehouseName}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${METHOD_BADGE[item.costingMethod] ?? 'bg-zinc-100 text-zinc-600'}`}
                    >
                      {COSTING_METHOD_LABELS[item.costingMethod] ?? item.costingMethod}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-700">{fmt(item.onHandQty)}</td>
                  <td className="px-4 py-3 text-right text-zinc-700">₱{fmt(item.avgUnitCost)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-zinc-900">
                    ₱{fmt(item.totalCostValue)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {items.length > 0 && (
            <tfoot className="border-t border-zinc-200 bg-zinc-50">
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-3 text-right text-sm font-semibold text-zinc-700"
                >
                  Grand Total
                </td>
                <td className="px-4 py-3 text-right text-sm font-bold text-prominent-purple-700">
                  ₱{fmt(valuation?.grandTotal ?? 0)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
