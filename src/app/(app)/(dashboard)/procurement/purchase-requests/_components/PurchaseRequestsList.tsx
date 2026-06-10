'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, RefreshCw, Search, Zap } from 'lucide-react'
import { purchaseRequestsApi } from '@/src/libs/api/procurement'
import type { PurchaseRequest, PurchaseRequestStatus } from '@/src/schema/procurement/types'

const STATUS_COLORS: Record<PurchaseRequestStatus, string> = {
  draft: 'bg-gray-100 text-gray-700 ring-gray-200',
  submitted: 'bg-blue-50 text-blue-700 ring-blue-200',
  approved: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  rejected: 'bg-red-50 text-red-700 ring-red-200',
  converted: 'bg-violet-50 text-violet-700 ring-violet-200',
  cancelled: 'bg-gray-100 text-gray-500 ring-gray-200',
}

function StatusBadge({ status }: { status: PurchaseRequestStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${STATUS_COLORS[status]}`}
    >
      {status}
    </span>
  )
}

export default function PurchaseRequestsList({
  canCreate,
  currentUserId,
  tenantId,
}: {
  canCreate: boolean
  currentUserId: string
  tenantId: string
}) {
  const [rows, setRows] = useState<PurchaseRequest[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sweepResult, setSweepResult] = useState<string | null>(null)
  const [sweeping, setSweeping] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    const res = await purchaseRequestsApi.list({
      search: search || undefined,
      status: (statusFilter as PurchaseRequestStatus) || undefined,
      limit: 50,
    })
    if (res.success && res.data) setRows(res.data.data)
    else setError(res.message ?? 'Failed to load purchase requests')
    setLoading(false)
  }

  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
  }, [search, statusFilter])

  async function runSweep() {
    setSweeping(true)
    setSweepResult(null)
    const res = await purchaseRequestsApi.sweepReorder(tenantId, currentUserId)
    setSweeping(false)
    if (res.success && res.data) {
      setSweepResult(
        `Swept ${res.data.sweptRules} rule(s) — ${res.data.triggered.length} new PR(s) created, ${res.data.skipped.length} skipped.`
      )
      load()
    } else {
      setSweepResult(res.message ?? 'Sweep failed')
    }
  }

  return (
    <div className="px-6 py-8 lg:px-10">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Purchase Requests</h1>
          <p className="mt-1 text-sm text-gray-500">
            Stock Controllers raise PRs; Procurement reviews and converts them into POs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={runSweep}
            disabled={sweeping}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            title="Auto-create PRs for items at or below reorder point"
          >
            <Zap className={`h-4 w-4 ${sweeping ? 'animate-pulse' : ''}`} />
            {sweeping ? 'Sweeping…' : 'Sweep reorder'}
          </button>
          {canCreate && (
            <Link
              href="/procurement/purchase-requests/new"
              className="inline-flex items-center gap-2 rounded-xl bg-prominent-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-prominent-orange-700"
            >
              <Plus className="h-4 w-4" />
              New PR
            </Link>
          )}
        </div>
      </header>

      {sweepResult && (
        <div className="mb-4 rounded-lg border border-prominent-orange-200 bg-prominent-orange-50/40 px-3 py-2 text-sm text-prominent-orange-800">
          {sweepResult}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search code or reason…"
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
          <option value="submitted">Submitted</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="converted">Converted</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <button
          onClick={load}
          className="rounded-lg border border-gray-200 bg-white p-2 text-gray-500 hover:bg-gray-50"
          title="Refresh"
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
              <th className="px-4 py-3">Trigger</th>
              <th className="px-4 py-3">Requested by</th>
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
                  No purchase requests yet.
                </td>
              </tr>
            )}
            {!loading &&
              !error &&
              rows.map((pr) => (
                <tr key={pr.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/procurement/purchase-requests/${pr.id}`}
                      className="font-medium text-prominent-orange-700 hover:underline"
                    >
                      {pr.code}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={pr.status} />
                  </td>
                  <td className="px-4 py-3 text-[13px] text-gray-600">
                    {pr.triggeredByReorder ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
                        <Zap className="h-3 w-3" />
                        Auto-reorder
                      </span>
                    ) : (
                      <span className="text-gray-400">Manual</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-[12px] text-gray-500">
                    {pr.requestedById.slice(0, 8)}…
                  </td>
                  <td className="px-4 py-3 text-[12px] text-gray-500">
                    {new Date(pr.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
