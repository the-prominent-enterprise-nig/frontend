'use client'

import { Download, TrendingUp, Package, DollarSign } from 'lucide-react'
import type { ValuationReportResponse } from '@/src/schema/inventory/reports'

interface Props {
  data: ValuationReportResponse | null | undefined
  isLoading: boolean
  isFetching: boolean
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value)
}

function exportToCsv(data: ValuationReportResponse) {
  const headers = [
    'Item Name',
    'SKU',
    'Category',
    'Warehouse',
    'On-Hand Qty',
    'Cost Price',
    'Total Value',
  ]
  const rows = data.data.map((item) => [
    item.itemName,
    item.sku,
    item.category ?? '',
    item.warehouseName ?? '',
    item.onHandQty,
    item.costPrice,
    item.totalValue,
  ])

  const csv = [headers, ...rows].map((row) => row.map((v) => `"${v}"`).join(',')).join('\n')

  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `stock-valuation-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function ValuationReport({ data, isLoading, isFetching }: Props) {
  const summary = data?.summary

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
              <Package className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Total Items</p>
              <p className="text-xl font-bold text-zinc-800">
                {isLoading ? '—' : (summary?.totalItems ?? 0).toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Total Qty on Hand</p>
              <p className="text-xl font-bold text-zinc-800">
                {isLoading ? '—' : (summary?.totalQty ?? 0).toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-prominent-purple-100">
              <DollarSign className="h-5 w-5 text-prominent-purple-700" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Total Inventory Value</p>
              <p className="text-xl font-bold text-zinc-800">
                {isLoading ? '—' : formatCurrency(summary?.totalValue ?? 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Table header with export */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">
          Valuation based on item cost price or weighted average if configured.
        </p>
        {(data?.data?.length ?? 0) > 0 && (
          <button
            type="button"
            onClick={() => data && exportToCsv(data)}
            className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        )}
      </div>

      {/* Table */}
      <div
        className={`overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-opacity ${isFetching ? 'opacity-60' : ''}`}
      >
        {isLoading ? (
          <div>
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 border-b border-zinc-100 px-6 py-4 last:border-0"
              >
                <div className="h-4 w-32 animate-pulse rounded bg-zinc-200" />
                <div className="h-4 w-20 animate-pulse rounded bg-zinc-200" />
                <div className="ml-auto h-4 w-20 animate-pulse rounded bg-zinc-200" />
              </div>
            ))}
          </div>
        ) : !data?.data?.length ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Package className="mb-3 h-10 w-10 text-zinc-300" />
            <p className="text-sm font-medium text-zinc-500">No valuation data available</p>
            <p className="mt-1 text-xs text-zinc-400">Stock movements will populate this report.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Item
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden sm:table-cell">
                    Category
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden md:table-cell">
                    Warehouse
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Qty
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden sm:table-cell">
                    Cost/Unit
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Total Value
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {data.data.map((item) => (
                  <tr key={`${item.itemId}-${item.warehouseId}`} className="hover:bg-zinc-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-zinc-800">{item.itemName}</p>
                      <p className="mt-0.5 text-xs font-mono text-zinc-400">{item.sku}</p>
                    </td>
                    <td className="px-4 py-3 text-zinc-500 hidden sm:table-cell">
                      {item.category ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 hidden md:table-cell">
                      {item.warehouseName ?? 'All'}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-zinc-700">
                      {item.onHandQty.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-500 hidden sm:table-cell">
                      {formatCurrency(item.costPrice)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-zinc-800">
                      {formatCurrency(item.totalValue)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-zinc-200 bg-zinc-50">
                  <td
                    colSpan={3}
                    className="px-4 py-3 text-sm font-semibold text-zinc-700 hidden md:table-cell"
                  >
                    Total
                  </td>
                  <td
                    colSpan={3}
                    className="px-4 py-3 text-sm font-semibold text-zinc-700 md:hidden"
                  >
                    Total
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-zinc-800">
                    {(summary?.totalQty ?? 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell" />
                  <td className="px-4 py-3 text-right font-bold text-zinc-800">
                    {formatCurrency(summary?.totalValue ?? 0)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
