'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, RefreshCw } from 'lucide-react'
import { TaxCodes, type TaxCodeListItem, type TaxCodeType } from '@/src/libs/data/AccountingV2Data'
import {
  TAX_BASE_RULE_LABELS,
  TAX_CODE_TYPES,
  TAX_CODE_TYPE_LABELS,
  fmtRate,
  usePostingKeyLabels,
} from './taxCodeLabels'

// Scenario 69 Part C — the tax code master from the client's NIG ERP Tax
// Setup workbook: what each tax is, its rate, what the rate applies to, and
// the account it posts to. One row per code; open one for its version history.
export default function TaxCodesList({ canCreate }: { canCreate: boolean }) {
  const router = useRouter()
  const { labels: postingLabels, ready: labelsReady } = usePostingKeyLabels()
  const [items, setItems] = useState<TaxCodeListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState({
    type: '' as TaxCodeType | '',
    search: '',
    includeInactive: false,
    asOf: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    const res = await TaxCodes.list({
      type: filters.type || undefined,
      search: filters.search.trim() || undefined,
      includeInactive: filters.includeInactive || undefined,
      asOf: filters.asOf || undefined,
    })
    if (res.success) {
      setItems(res.data ?? [])
      setError(null)
    } else {
      setError(res.message || res.error || 'Could not load the tax codes')
    }
    setLoading(false)
  }, [filters])

  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
  }, [load])

  return (
    <div className="px-6 py-6 lg:px-10">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-prominent-purple-900">Tax Codes</h1>
          <p className="mt-1 text-sm text-gray-500">
            What each tax is, its rate, what the rate applies to, and the account it posts to. A
            rate change is a new version of a code, so earlier transactions keep the rate they were
            taxed at.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={load}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-purple-700 hover:bg-purple-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          {canCreate && (
            <Link
              href="/accounting/tax-codes/new"
              className="flex items-center gap-2 rounded-lg bg-purple-700 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-800"
            >
              <Plus className="h-4 w-4" /> New Tax Code
            </Link>
          )}
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
        The rates below are the client&rsquo;s workbook values and are provisional. NIG&rsquo;s
        accountant must confirm each rate and supply the ATC list before go-live &mdash; no ATC is
        set yet.
      </div>

      <div className="mb-3 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-600">Type</span>
          <select
            value={filters.type}
            onChange={(e) => setFilters({ ...filters, type: e.target.value as TaxCodeType | '' })}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
          >
            <option value="">All types</option>
            {TAX_CODE_TYPES.map((t) => (
              <option key={t} value={t}>
                {TAX_CODE_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="block min-w-[220px] flex-1">
          <span className="mb-1 block text-xs font-medium text-gray-600">Search</span>
          <input
            placeholder="Code or name…"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-600">Rates as of</span>
          <input
            type="date"
            value={filters.asOf}
            onChange={(e) => setFilters({ ...filters, asOf: e.target.value })}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={filters.includeInactive}
            onChange={(e) => setFilters({ ...filters, includeInactive: e.target.checked })}
          />
          Show inactive codes
        </label>
      </div>

      {error && (
        <div className="mb-3 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left">Code</th>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-right">Rate</th>
              <th className="px-3 py-2 text-left">Applied to</th>
              <th className="px-3 py-2 text-left">ATC</th>
              <th className="px-3 py-2 text-left">Posts to</th>
              <th className="px-3 py-2 text-left">Notes</th>
            </tr>
          </thead>
          <tbody>
            {loading && items.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-gray-400">
                  Loading...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-gray-400">
                  No tax codes found.
                </td>
              </tr>
            ) : (
              items.map((t) => (
                <tr
                  key={t.code}
                  onClick={() => router.push(`/accounting/tax-codes/${encodeURIComponent(t.code)}`)}
                  className="cursor-pointer border-t border-gray-100 hover:bg-purple-50/40"
                >
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs font-semibold text-purple-700">
                    {t.code}
                  </td>
                  <td className="px-3 py-2">{t.name}</td>
                  <td className="px-3 py-2 text-gray-600">{TAX_CODE_TYPE_LABELS[t.taxType]}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {fmtRate(t.ratePercent, t.baseRule)}
                    {t.next && (
                      <div className="text-[11px] text-amber-700">
                        {fmtRate(t.next.ratePercent, t.baseRule)} from {t.next.effectiveFrom}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-600">{TAX_BASE_RULE_LABELS[t.baseRule]}</td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {t.atc ?? <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-3 py-2 text-gray-600">
                    {t.accountMappingKey ? (
                      labelsReady ? (
                        (postingLabels.get(t.accountMappingKey) ?? t.accountMappingKey)
                      ) : (
                        ''
                      )
                    ) : (
                      <span className="text-gray-400">No tax posted</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {t.isDefault && <Chip tone="purple">Default</Chip>}
                      {t.requiresApproval && <Chip tone="amber">Needs approval</Chip>}
                      {!t.isActive && <Chip tone="gray">Inactive</Chip>}
                      {t.status === 'UPCOMING' && (
                        <Chip tone="amber">Starts {t.effectiveFrom}</Chip>
                      )}
                      {t.status === 'ENDED' && <Chip tone="gray">Ended {t.effectiveTo}</Chip>}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Chip({
  tone,
  children,
}: {
  tone: 'purple' | 'amber' | 'gray'
  children: React.ReactNode
}) {
  const style =
    tone === 'purple'
      ? 'bg-purple-50 text-purple-700'
      : tone === 'amber'
        ? 'bg-amber-50 text-amber-800'
        : 'bg-gray-100 text-gray-600'
  return (
    <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${style}`}>{children}</span>
  )
}
