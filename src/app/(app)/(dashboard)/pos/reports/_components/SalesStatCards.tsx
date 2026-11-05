'use client'

import type { SalesSummary } from '@/src/schema/pos/sales-reports'

export function money(n: number): string {
  return n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function share(n: number): string {
  return `${(n * 100).toLocaleString('en-PH', { maximumFractionDigits: 1 })}% of total sales`
}

/** Scenario 85 — the four stat cards every Sales Reports tab shows. Money is
 * gross sales at LCP (VAT-inclusive), with refunds netted in. */
export default function SalesStatCards({
  summary,
  loading,
}: {
  summary: SalesSummary | undefined
  loading: boolean
}): React.JSX.Element {
  const value = (fn: (s: SalesSummary) => string): string =>
    summary ? fn(summary) : loading ? '…' : '—'

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Card label="Total Sales (gross)" value={value((s) => money(s.totalGross))} />
      <Card
        label="Office Sales"
        value={value((s) => money(s.officeGross))}
        note={summary && share(summary.officeShare)}
      />
      <Card
        label="Agent Sales"
        value={value((s) => money(s.agentGross))}
        note={summary && share(summary.agentShare)}
      />
      <Card label="Total Quantity Sold" value={value((s) => s.units.toLocaleString('en-PH'))} />
    </div>
  )
}

function Card({
  label,
  value,
  note,
}: {
  label: string
  value: string
  note?: string
}): React.JSX.Element {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-1 text-xl font-semibold text-zinc-900 tabular-nums">{value}</div>
      {note && <div className="mt-0.5 text-xs text-zinc-500">{note}</div>}
    </div>
  )
}
