'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { RefreshCw } from 'lucide-react'
import { goodsReceiptsApi } from '@/src/libs/api/procurement'
import type { GoodsReceipt } from '@/src/schema/procurement/types'

export default function GoodsReceivingList({ canCreate }: { canCreate: boolean }) {
  const [rows, setRows] = useState<GoodsReceipt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const res = await goodsReceiptsApi.list({ limit: 50 })
    if (res.success && res.data) setRows(res.data.data)
    else setError(res.message ?? 'Failed to load')
    setLoading(false)
  }
  useEffect(() => {
    load()
  }, [])

  return (
    <div className="px-6 py-8 lg:px-10">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Goods Receiving</h1>
          <p className="mt-1 text-sm text-gray-500">
            Receive goods against open POs. Each receipt updates inventory immediately.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="rounded-lg border border-gray-200 bg-white p-2 text-gray-500 hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          {canCreate && (
            <Link
              href="/procurement/purchase-orders?status=sent"
              className="inline-flex items-center gap-2 rounded-xl bg-prominent-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-prominent-orange-700"
            >
              Receive a PO →
            </Link>
          )}
        </div>
      </header>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-4 py-3">Receipt code</th>
              <th className="px-4 py-3">PO</th>
              <th className="px-4 py-3">Warehouse</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Received</th>
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
                  No goods received yet. Open a PO that&apos;s been sent and receive against it.
                </td>
              </tr>
            )}
            {!loading &&
              !error &&
              rows.map((gr) => (
                <tr key={gr.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{gr.code}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/procurement/purchase-orders/${gr.purchaseOrderId}`}
                      className="text-prominent-orange-700 hover:underline"
                    >
                      {gr.purchaseOrder?.code ?? gr.purchaseOrderId.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[13px] text-gray-700">
                    {gr.warehouse?.name ?? gr.warehouseId.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
                      {gr.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-gray-500">
                    {new Date(gr.receivedAt).toLocaleString()}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
