'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Search, HandCoins } from 'lucide-react'
import { collectorsApi } from '@/src/libs/api/crm'
import { getBranches } from '../_actions/get-branches'
import type { Collector } from '@/src/schema/crm/types'

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  inactive: 'bg-gray-100 text-gray-600 ring-gray-200',
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
        STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-600 ring-gray-200'
      }`}
    >
      {status}
    </span>
  )
}

export default function CollectorsList({ canCreate }: { canCreate: boolean }) {
  const [collectors, setCollectors] = useState<Collector[]>([])
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [branchFilter, setBranchFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getBranches().then((res) => {
      if (res.success && res.data) setBranches(res.data.data)
    })
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const t = setTimeout(async () => {
      setLoading(true)
      setError(null)
      const res = await collectorsApi.list({
        search: search || undefined,
        status: statusFilter || undefined,
        branchId: branchFilter || undefined,
        limit: 50,
      })
      if (controller.signal.aborted) return
      if (res.success && res.data) setCollectors(res.data.data)
      else setError(res.error ?? 'Failed to load collectors')
      setLoading(false)
    }, 250)
    return () => {
      controller.abort()
      clearTimeout(t)
    }
  }, [search, statusFilter, branchFilter])

  const branchName = (id?: string | null) => branches.find((b) => b.id === id)?.name

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Collectors</h1>
          <p className="mt-1 text-sm text-gray-500">
            Field collectors, their assigned accounts, and remittance history.
          </p>
        </div>
        {canCreate && (
          <Link
            href="/crm/collectors/new"
            className="inline-flex items-center gap-2 rounded-xl bg-prominent-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-prominent-orange-700"
          >
            <Plus className="h-4 w-4" />
            New collector
          </Link>
        )}
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search stub number or name…"
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-prominent-orange-400 focus:outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <select
          value={branchFilter}
          onChange={(e) => setBranchFilter(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
        >
          <option value="">All branches</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      {loading && (
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-12 text-center text-gray-400">
          Loading…
        </div>
      )}
      {!loading && error && (
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-12 text-center text-red-500">
          {error}
        </div>
      )}
      {!loading && !error && collectors.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-12 text-center text-gray-400">
          No collectors match these filters yet.
        </div>
      )}

      {!loading && !error && collectors.length > 0 && (
        <>
          {/* Mobile: card list */}
          <ul className="space-y-3 md:hidden">
            {collectors.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/crm/collectors/${c.id}`}
                  className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm active:bg-gray-50"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-prominent-orange-100 text-prominent-orange-700">
                    <HandCoins className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium text-gray-900">{c.name}</span>
                      <StatusBadge status={c.status} />
                    </div>
                    <div className="mt-0.5 truncate text-[12px] text-gray-500">
                      {c.stubNumber} · {branchName(c.branchId) ?? 'Unassigned branch'}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          {/* Desktop: table */}
          <div className="hidden overflow-hidden rounded-xl border border-gray-200 bg-white md:block">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Stub #</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Branch</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-800">
                  {collectors.map((c) => (
                    <tr key={c.id} className="transition-colors hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        <Link
                          href={`/crm/collectors/${c.id}`}
                          className="hover:text-prominent-orange-700 hover:underline"
                        >
                          {c.stubNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3">{c.name}</td>
                      <td className="px-4 py-3 text-[13px] text-gray-600">
                        {branchName(c.branchId) ?? <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={c.status} />
                      </td>
                      <td className="px-4 py-3 text-[12px] text-gray-500">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
