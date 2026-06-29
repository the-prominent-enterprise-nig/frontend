'use client'

import { Loader2 } from 'lucide-react'
import { usePurchaseOrders } from '../_hooks/usePurchaseOrders'
import type { PurchaseOrderSummary } from '@/src/schema/inventory/purchase-orders'

const STATUS_TABS = [
  { label: 'All', value: undefined },
  { label: 'Draft', value: 'draft' },
  { label: 'Sent', value: 'sent' },
  { label: 'Received', value: 'received' },
] as const

function PoStatusBadge({ status }: { status: PurchaseOrderSummary['status'] }) {
  const styles: Record<string, string> = {
    draft: 'bg-zinc-100 text-zinc-600',
    sent: 'bg-blue-100 text-blue-700',
    acknowledged: 'bg-indigo-100 text-indigo-700',
    partially_received: 'bg-yellow-100 text-yellow-700',
    received: 'bg-green-100 text-green-700',
    closed: 'bg-zinc-100 text-zinc-500',
    cancelled: 'bg-red-100 text-red-700',
  }
  const labels: Record<string, string> = {
    draft: 'Draft',
    sent: 'Sent',
    acknowledged: 'Acknowledged',
    partially_received: 'Partially Received',
    received: 'Received',
    closed: 'Closed',
    cancelled: 'Cancelled',
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status] ?? 'bg-zinc-100 text-zinc-600'}`}
    >
      {labels[status] ?? status}
    </span>
  )
}

export function PurchaseOrderList() {
  const {
    items,
    pagination,
    isLoading,
    statusFilter,
    setStatusFilter,
    page,
    setPage,
    sendPO,
    isSending,
  } = usePurchaseOrders()

  return (
    <div className="p-6">
      {/* Page Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Purchase Orders</h1>
          <p className="mt-1 text-sm text-zinc-500">
            View and manage purchase orders across your organisation
          </p>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="mb-4 flex flex-wrap gap-1 border-b border-zinc-200">
        {STATUS_TABS.map((tab) => (
          <button
            key={String(tab.value)}
            type="button"
            onClick={() => setStatusFilter(tab.value)}
            className={`px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              statusFilter === tab.value
                ? 'border-prominent-purple-600 text-prominent-purple-700'
                : 'border-transparent text-zinc-500 hover:text-zinc-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-zinc-500">No purchase orders found</p>
            <p className="mt-1 text-xs text-zinc-400">
              Purchase orders are created from approved purchase requests
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Code
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Supplier
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Total Amount
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    From PR
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Created
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {items.map((po) => (
                  <tr key={po.id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm font-medium text-zinc-900">{po.code}</span>
                    </td>
                    <td className="px-4 py-3 text-zinc-700">{po.supplier.name}</td>
                    <td className="px-4 py-3">
                      <PoStatusBadge status={po.status} />
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-zinc-900">
                      {Number(po.totalAmount).toLocaleString('en-PH', {
                        style: 'currency',
                        currency: 'PHP',
                      })}
                    </td>
                    <td className="px-4 py-3">
                      {po.fromPr ? (
                        <span className="font-mono text-xs text-zinc-600">{po.fromPr.code}</span>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {new Date(po.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {po.status === 'draft' && (
                          <button
                            type="button"
                            onClick={() => sendPO(po.id)}
                            disabled={isSending}
                            className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                          >
                            Send
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-zinc-500">
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage(page - 1)}
              disabled={page <= 1}
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage(page + 1)}
              disabled={page >= pagination.totalPages}
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
