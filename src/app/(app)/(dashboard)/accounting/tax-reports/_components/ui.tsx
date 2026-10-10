'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ApiResponse } from '@/src/libs/api/client'
import { fmtMoney } from '@/src/libs/data/AccountingV2Data'
import type { TaxRowFlag } from '@/src/libs/data/TaxReportsData'
import {
  FLAG_LABEL,
  FLAG_TONE,
  documentHref,
  journalHref,
  type Tone,
} from '@/src/libs/tax/tax-reports'

// Scenario 69 Part H — the small pieces every tax report screen shares.

const CHIP_STYLE: Record<Tone, string> = {
  purple: 'bg-purple-50 text-purple-700',
  blue: 'bg-blue-50 text-blue-700',
  amber: 'bg-amber-50 text-amber-800',
  gray: 'bg-gray-100 text-gray-600',
  red: 'bg-red-50 text-red-700',
  green: 'bg-green-50 text-green-700',
}

export function Chip({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-medium ${CHIP_STYLE[tone]}`}
    >
      {children}
    </span>
  )
}

export function FlagChips({ flags }: { flags: TaxRowFlag[] }) {
  if (!flags.length) return null
  return (
    <div className="flex flex-wrap gap-1">
      {flags.map((f) => (
        <Chip key={f} tone={FLAG_TONE[f]}>
          {FLAG_LABEL[f]}
        </Chip>
      ))}
    </div>
  )
}

/** A peso amount, right-aligned and tabular; a dash for nothing at all. */
export function Money({
  value,
  zeroAsDash = false,
  bold = false,
}: {
  value: number | null | undefined
  zeroAsDash?: boolean
  bold?: boolean
}) {
  if (value === null || value === undefined || (zeroAsDash && Math.abs(value) < 0.005)) {
    return <span className="text-gray-300">—</span>
  }
  return (
    <span
      className={`whitespace-nowrap tabular-nums ${bold ? 'font-semibold' : ''} ${value < 0 ? 'text-red-700' : ''}`}
    >
      {fmtMoney(value)}
    </span>
  )
}

export function StatCard({
  label,
  value,
  hint,
  testId,
  tone = 'purple',
}: {
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
  testId?: string
  tone?: 'purple' | 'amber' | 'red' | 'green' | 'gray'
}) {
  const border =
    tone === 'amber'
      ? 'border-amber-200'
      : tone === 'red'
        ? 'border-red-200'
        : tone === 'green'
          ? 'border-green-200'
          : tone === 'gray'
            ? 'border-gray-200'
            : 'border-purple-100'
  return (
    <div data-testid={testId} className={`rounded-lg border ${border} bg-white px-4 py-3`}>
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-prominent-purple-900">{value}</div>
      {hint && <div className="mt-0.5 text-[12px] text-gray-500">{hint}</div>}
    </div>
  )
}

/** A source document's number, as a link to its page when it has one. */
export function DocCell({
  documentType,
  documentNo,
  documentId,
}: {
  documentType: string
  documentNo: string | null
  documentId: string | null
}) {
  const href = documentHref(documentType, documentId)
  return (
    <div>
      {documentNo ? (
        href ? (
          <Link
            href={href}
            className="whitespace-nowrap font-medium text-purple-700 hover:underline"
          >
            {documentNo}
          </Link>
        ) : (
          <span className="whitespace-nowrap font-medium">{documentNo}</span>
        )
      ) : (
        <span className="text-gray-400">—</span>
      )}
      <div className="text-[11px] text-gray-500">{documentType}</div>
    </div>
  )
}

export function EntryLink({
  journalEntryId,
  journalRef,
}: {
  journalEntryId: string | null
  journalRef: string
}) {
  const href = journalHref(journalEntryId)
  if (!href) return <span className="text-gray-300">—</span>
  return (
    <Link
      href={href}
      className="whitespace-nowrap font-mono text-[11px] text-purple-700 hover:underline"
    >
      {journalRef}
    </Link>
  )
}

/** What a closing run has done to the row: the run that cleared it, or nothing. */
export function SettledCell({ settledIn }: { settledIn: string | null }) {
  return settledIn ? (
    <Chip tone="green">{settledIn}</Chip>
  ) : (
    <span className="text-[12px] text-gray-400">Open</span>
  )
}

export function TableShell({ testId, children }: { testId: string; children: React.ReactNode }) {
  return (
    <div
      data-testid={testId}
      className="overflow-x-auto rounded-lg border border-gray-200 bg-white"
    >
      <table className="w-full text-sm">{children}</table>
    </div>
  )
}

export const TH = 'px-3 py-2 text-left whitespace-nowrap'
export const THR = 'px-3 py-2 text-right whitespace-nowrap'
export const HEAD = 'bg-gray-50 text-xs uppercase text-gray-600'

export function EmptyRow({
  cols,
  loading,
  text,
}: {
  cols: number
  loading: boolean
  text: string
}) {
  return (
    <tr>
      <td colSpan={cols} className="px-3 py-8 text-center text-gray-400">
        {loading ? 'Loading...' : text}
      </td>
    </tr>
  )
}

/**
 * Loads a report for a query, a moment after the last change to it (so typing in
 * a search box is not a request a keystroke). The fetcher and the query are read
 * through refs: only a change to the query's contents loads again. Only the answer
 * to the latest request is shown: a slow earlier one that lands after it is dropped.
 */
export function useTaxReport<Q extends object, T>(
  fetcher: (query: Q) => Promise<ApiResponse<T>>,
  query: Q,
  enabled = true
) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const fetcherRef = useRef(fetcher)
  const queryRef = useRef(query)
  const latestRef = useRef(0)
  useEffect(() => {
    fetcherRef.current = fetcher
    queryRef.current = query
  })
  const key = JSON.stringify(query)

  const load = useCallback(async () => {
    const mine = ++latestRef.current
    setLoading(true)
    const res = await fetcherRef.current(queryRef.current)
    if (mine !== latestRef.current) return
    if (res.success && res.data) {
      setData(res.data)
      setError(null)
    } else {
      setData(null)
      setError(res.message || res.error || 'Could not load the report')
    }
    setLoading(false)
  }, [])

  // `key` stands for the query's contents: a change to it is what loads again.
  useEffect(() => {
    if (!enabled) return
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
  }, [key, load, enabled])

  return { data, loading, error, reload: load }
}
