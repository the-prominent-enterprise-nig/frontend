'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { BellPlus, Plus, Search } from 'lucide-react'
import { customersApi } from '@/src/libs/api/crm'
import ScheduleReminderModal from '@/src/components/crm/ScheduleReminderModal'
import type { Customer } from '@/src/schema/crm/types'

const SOURCE_LABEL: Record<string, string> = {
  pos_walkin: 'POS Walk-in',
  sales: 'Sales',
  crm_lead: 'CRM Lead',
  online: 'Online',
}

const SOURCE_COLORS: Record<string, string> = {
  pos_walkin: 'bg-amber-50 text-amber-700 ring-amber-200',
  sales: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  crm_lead: 'bg-prominent-orange-50 text-prominent-orange-700 ring-prominent-orange-200',
  online: 'bg-sky-50 text-sky-700 ring-sky-200',
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  inactive: 'bg-gray-100 text-gray-600 ring-gray-200',
  blocked: 'bg-red-50 text-red-700 ring-red-200',
}

function SourceChip({ source }: { source: string }) {
  const tone = SOURCE_COLORS[source] ?? 'bg-gray-100 text-gray-600 ring-gray-200'
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${tone}`}
    >
      {SOURCE_LABEL[source] ?? source}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-600 ring-gray-200'
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${tone}`}
    >
      {status}
    </span>
  )
}

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0])
      .join('')
      .toUpperCase() || '·'
  )
}

export default function CustomersList({
  canScheduleReminder,
  canCreate,
  currentUserId,
  tenantId,
}: {
  canScheduleReminder: boolean
  canCreate: boolean
  currentUserId: string
  tenantId: string
}) {
  const router = useRouter()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reminderForCustomerId, setReminderForCustomerId] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true)
      setError(null)
      const res = await customersApi.list({
        search: search || undefined,
        status: statusFilter || undefined,
        sourceChannel: sourceFilter || undefined,
        limit: 50,
      })
      if (res.success && res.data) setCustomers(res.data.data)
      else setError(res.error ?? 'Failed to load customers')
      setLoading(false)
    }, 250)
    return () => clearTimeout(t)
  }, [search, statusFilter, sourceFilter])

  return (
    <div className="px-6 py-8 lg:px-10">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Customers</h1>
          <p className="mt-1 text-sm text-gray-500">
            Unified view across leads, orders, and POS history.
          </p>
        </div>
        {canCreate && (
          <Link
            href="/crm/customers/new"
            className="inline-flex items-center gap-2 rounded-xl bg-prominent-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-prominent-orange-700"
          >
            <Plus className="h-4 w-4" />
            Add Customer
          </Link>
        )}
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search code, name, email, phone, company…"
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
          <option value="blocked">Blocked</option>
        </select>
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
        >
          <option value="">All sources</option>
          <option value="pos_walkin">POS Walk-in</option>
          <option value="sales">Sales</option>
          <option value="crm_lead">CRM Lead</option>
          <option value="online">Online</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email / Phone</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Status</th>
              {canScheduleReminder && <th className="px-4 py-3"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-gray-800">
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && error && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-red-500">
                  {error}
                </td>
              </tr>
            )}
            {!loading && !error && customers.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                  No customers found.
                </td>
              </tr>
            )}
            {!loading &&
              !error &&
              customers.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => router.push(`/crm/customers/${c.id}`)}
                  className="group cursor-pointer transition-colors hover:bg-gray-50"
                >
                  <td className="px-4 py-3 font-mono text-[11.5px] text-gray-500">
                    {c.customerCode}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ${
                          c.customerType === 'business'
                            ? 'bg-prominent-orange-100 text-prominent-orange-700'
                            : 'bg-sky-100 text-sky-700'
                        }`}
                      >
                        {initials(c.name)}
                      </span>
                      <div className="min-w-0">
                        <span className="block font-medium text-gray-900 group-hover:text-prominent-orange-700 group-hover:underline">
                          {c.name}
                        </span>
                        <div className="truncate text-[12px] text-gray-500">
                          {c.companyName ?? <span className="capitalize">{c.customerType}</span>}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[13px]">
                    <div className="text-gray-700">
                      {c.email ?? <span className="text-gray-400">—</span>}
                    </div>
                    <div className="text-[12px] text-gray-500">{c.phone ?? '—'}</div>
                  </td>
                  <td className="px-4 py-3">
                    <SourceChip source={c.sourceChannel} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={c.status} />
                  </td>
                  {canScheduleReminder && (
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setReminderForCustomerId(c.id)
                        }}
                        className="rounded-lg p-1.5 text-gray-400 opacity-0 transition-opacity hover:bg-prominent-orange-50 hover:text-prominent-orange-700 group-hover:opacity-100"
                        title="Schedule reminder"
                        aria-label="Schedule reminder"
                      >
                        <BellPlus className="h-4 w-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {canScheduleReminder && (
        <ScheduleReminderModal
          open={reminderForCustomerId !== null}
          onClose={() => setReminderForCustomerId(null)}
          tenantId={tenantId}
          assignedTo={currentUserId}
          target={
            reminderForCustomerId ? { customerId: reminderForCustomerId } : { customerId: '' }
          }
        />
      )}
    </div>
  )
}
