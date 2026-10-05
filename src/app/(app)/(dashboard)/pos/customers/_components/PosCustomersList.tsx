'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Search, UserPlus, Loader2, Pencil } from 'lucide-react'
import { posCustomersApi } from '@/src/libs/api/pos-customers'
import type { Customer } from '@/src/schema/crm/types'

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('') || '?'
  )
}

/**
 * POS's own customers screen. Deliberately NOT a reuse of CRM's
 * CustomersList: that one is a 285-line management surface built around
 * reminders, duplicate review and segments, none of which a till has any
 * use for. Parameterising all of it away would leave a CRM screen with half
 * its features hidden — this is a different screen for a different job
 * (look someone up, add a walk-in, fix a typo), not a duplicate of it.
 *
 * The records are the same records: posCustomersApi hits /pos/customers,
 * which runs the same CustomerService as /crm/customers. A customer added
 * here is in CRM the instant it saves.
 */
export default function PosCustomersList({
  canCreate,
  canUpdate,
}: {
  canCreate: boolean
  canUpdate: boolean
}) {
  const [search, setSearch] = useState('')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    // Debounced so typing a name doesn't fire a request per keystroke.
    const timer = setTimeout(() => {
      posCustomersApi
        .list({ search: search.trim() || undefined, limit: 50 })
        .then((res) => {
          if (cancelled) return
          setLoading(false)
          if (res.success && res.data) {
            setCustomers(res.data.data ?? [])
            setError('')
          } else {
            setCustomers([])
            setError(res.error ?? 'Could not load customers')
          }
        })
        .catch(() => {
          if (cancelled) return
          setLoading(false)
          setError('Could not load customers')
        })
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [search])

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-6 lg:px-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Customers</h1>
          <p className="text-sm text-zinc-500">
            The same customer records as CRM — add a walk-in or correct a profile without leaving
            POS.
          </p>
        </div>
        {canCreate && (
          <Link
            href="/pos/customers/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-prominent-purple-700 px-3 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800"
          >
            <UserPlus className="h-4 w-4" />
            New Customer
          </Link>
        )}
      </div>

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, customer code, phone or email…"
          className="w-full rounded-lg border border-zinc-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
        />
      </div>

      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {loading ? (
        <div className="flex items-center gap-2 px-1 py-8 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading customers…
        </div>
      ) : customers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-200 px-4 py-10 text-center">
          <p className="text-sm text-zinc-600">
            {search.trim() ? `No customers match “${search.trim()}”.` : 'No customers yet.'}
          </p>
          {canCreate && (
            <Link
              href="/pos/customers/new"
              className="mt-2 inline-block text-sm font-medium text-prominent-purple-700 hover:underline"
            >
              Add a new customer
            </Link>
          )}
        </div>
      ) : (
        <ul className="divide-y divide-zinc-100 overflow-hidden rounded-lg border border-zinc-200 bg-white">
          {customers.map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-3 py-3 hover:bg-zinc-50">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-600">
                {initials(c.name)}
              </span>
              {/* The row opens the read-only profile — reading someone's
                  details shouldn't mean opening a form that can change
                  them. min-w-0 so a long name truncates instead of pushing
                  the action off the row. */}
              <Link href={`/pos/customers/${c.id}`} className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-900 hover:text-prominent-purple-700">
                  {c.name}
                </p>
                <p className="truncate text-xs text-zinc-500">
                  {[c.customerCode, c.phone, c.email].filter(Boolean).join(' · ') || '—'}
                </p>
              </Link>
              {canUpdate && (
                <Link
                  href={`/pos/customers/${c.id}/edit?returnTo=/pos/customers`}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
