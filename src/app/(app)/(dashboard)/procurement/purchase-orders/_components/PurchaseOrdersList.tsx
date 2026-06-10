'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, RefreshCw, Search } from 'lucide-react'
import { purchaseOrdersApi } from '@/src/libs/api/procurement'
import type { PurchaseOrder, PurchaseOrderStatus } from '@/src/schema/procurement/types'

const STATUS_COLORS: Record<PurchaseOrderStatus, string> = {
  draft: 'bg-gray-100 text-gray-700 ring-gray-200',
  sent: 'bg-blue-50 text-blue-700 ring-blue-200',
  partially_received: 'bg-amber-50 text-amber-700 ring-amber-200',
  fully_received: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  closed: 'bg-violet-50 text-violet-700 ring-violet-200',
  cancelled: 'bg-gray-100 text-gray-500 ring-gray-200',
}

function StatusBadge({ status }: { status: PurchaseOrderStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${STATUS_COLORS[status]}`}
    >
      {status.replace('_', ' ')}
    </span>
  )
}

export default function PurchaseOrdersList({ canCreate }: { canCreate: boolean }) {
  const [rows, setRows] = useState<PurchaseOrder[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const res = await purchaseOrdersApi.list({
      search: search || undefined,
      status: (statusFilter as PurchaseOrderStatus) || undefined,
      limit: 50,
    })
    if (res.success && res.data) setRows(res.data.data)
    else setError(res.message ?? 'Failed to load')
    setLoading(false)
  }

  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
  }, [search, statusFilter])

  return (
    <div className="px-6 py-8 lg:px-10">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Purchase Orders</h1>
          <p className="mt-1 text-sm text-gray-500">
            Issued to suppliers; receive against POs to update inventory.
          </p>
        </div>
        {canCreate && (
          <Link
            href="/procurement/purchase-orders/new"
            className="inline-flex items-center gap-2 rounded-xl bg-prominent-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-prominent-orange-700"
          >
            <Plus className="h-4 w-4" />
            New PO
          </Link>
        )}
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search code…"
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-prominent-orange-400 focus:outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="partially_received">Partially received</option>
          <option value="fully_received">Fully received</option>
          <option value="closed">Closed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <button
          onClick={load}
          className="rounded-lg border border-gray-200 bg-white p-2 text-gray-500 hover:bg-gray-50"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3">Expected delivery</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-gray-800">
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && error && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-red-500">
                  {error}
                </td>
              </tr>
            )}
            {!loading && !error && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-gray-400">
                  No purchase orders yet.
                </td>
              </tr>
            )}
            {!loading &&
              !error &&
              rows.map((po) => (
                <tr key={po.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/procurement/purchase-orders/${po.id}`}
                      className="font-medium text-prominent-orange-700 hover:underline"
                    >
                      {po.code}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={po.status} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">
                    ₱{Number(po.totalAmount).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-[13px] text-gray-700">
                    {po.expectedDeliveryDate
                      ? new Date(po.expectedDeliveryDate).toLocaleDateString()
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-[12px] text-gray-500">
                    {new Date(po.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
