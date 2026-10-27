'use client'

import type { ElementType, ReactNode } from 'react'
import { fmtDate, fmtMoney } from '@/src/libs/data/AccountingV2Data'
import type { InstallmentLedgerRow } from '@/src/schema/crm/types'

// The pieces both customer-ledger views are drawn from — the single plan's
// paper-form ledger (InstallmentLedgerBody) and the whole-customer one
// (CustomerLedgerView) — so the two read as one page. Same look as the
// installment account page: white cards with an icon heading, a pale band of
// headline figures, and text sized and contrasted for easy reading.

// The app's shared card recipe (DashboardWidgetWrapper's CARD_SHADOW_RESTING):
// a soft layered shadow that reads as depth without going heavy.
export const LEDGER_CARD =
  'rounded-2xl border border-gray-200/80 bg-white shadow-[0_1px_2px_rgba(29,15,56,0.03),0_8px_24px_-8px_rgba(29,15,56,0.08)]'

/** A secondary action in the ledger header. */
export const LEDGER_ACTION =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50'

/** A titled card — an icon, a heading, and its content. */
export function LedgerCard({
  title,
  icon: Icon,
  className = '',
  children,
}: {
  title: string
  icon: ElementType
  className?: string
  children: ReactNode
}) {
  return (
    <section className={`${LEDGER_CARD} p-4 ${className}`}>
      <div className="mb-3 flex items-center gap-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-prominent-purple-100 text-prominent-purple-700">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <h2 className="text-[14px] font-semibold text-prominent-purple-900">{title}</h2>
      </div>
      {children}
    </section>
  )
}

/** The ledger's header card: who it is and what can be done to it, over a pale
 * band of the figures that matter most. */
export function LedgerHero({
  header,
  figures,
}: {
  header: ReactNode
  figures: { label: string; value: string; accent?: boolean }[]
}) {
  return (
    <div className={`${LEDGER_CARD} overflow-hidden`}>
      <header className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
        {header}
      </header>
      <div
        className={`grid grid-cols-2 gap-x-6 gap-y-3 border-t border-prominent-purple-100 bg-prominent-purple-50 px-5 py-3 sm:grid-cols-3 lg:gap-x-0 lg:divide-x lg:divide-prominent-purple-200 ${
          figures.length >= 5 ? 'lg:grid-cols-5' : 'lg:grid-cols-4'
        }`}
      >
        {figures.map((f) => (
          <div key={f.label} className="lg:px-5 lg:first:pl-0">
            <p className="text-[12px] text-gray-600">{f.label}</p>
            <p
              className={`mt-0.5 text-xl font-semibold tracking-tight ${
                f.accent ? 'text-prominent-orange-800' : 'text-prominent-purple-900'
              }`}
            >
              {f.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Labelled values: each label over its value, `columns` to a row. */
export function LedgerFields({
  fields,
  columns = 2,
}: {
  fields: { label: string; value: ReactNode }[]
  columns?: 2 | 3 | 4 | 6
}) {
  const cols =
    columns === 6
      ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'
      : columns === 4
        ? 'grid-cols-2 lg:grid-cols-4'
        : columns === 3
          ? 'grid-cols-2 sm:grid-cols-3'
          : 'grid-cols-2'
  return (
    <dl className={`grid gap-x-5 gap-y-2.5 ${cols}`}>
      {fields.map((f) => (
        <div key={f.label}>
          <dt className="text-[12px] text-gray-600">{f.label}</dt>
          <dd className="text-[13px] font-medium text-prominent-purple-900">{f.value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** The Date / Ref / Inst. / Description / Debit / Credit / Due / Outstanding
 * table — one row per ledger event, with the debit and credit totals at the
 * foot (a display-only row is shown but never added in). */
export function LedgerTable({ rows }: { rows: InstallmentLedgerRow[] }) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-gray-500">No ledger activity yet.</p>
  }
  const sum = (pick: (r: InstallmentLedgerRow) => number) =>
    rows.filter((r) => !r.displayOnly).reduce((total, r) => total + pick(r), 0)

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="bg-gray-50 text-left text-[12px] font-semibold uppercase tracking-wide text-gray-600">
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2">Ref</th>
            <th className="px-3 py-2 text-right">Inst.</th>
            <th className="px-3 py-2">Description</th>
            <th className="px-3 py-2 text-right">Debit</th>
            <th className="px-3 py-2 text-right">Credit</th>
            <th className="px-3 py-2 text-right">Due</th>
            <th className="px-3 py-2 text-right">Outstanding</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50">
              <td className="whitespace-nowrap px-3 py-1.5 text-gray-700">{fmtDate(row.date)}</td>
              <td className="whitespace-nowrap px-3 py-1.5 font-mono text-[13px] text-gray-600">
                {row.ref}
              </td>
              <td className="px-3 py-1.5 text-right text-gray-600">
                {row.inst > 0 ? row.inst : '—'}
              </td>
              <td className="px-3 py-1.5 font-medium text-prominent-purple-900">
                {row.description}
              </td>
              <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-gray-800">
                {row.debit > 0 ? fmtMoney(row.debit) : '—'}
              </td>
              <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-gray-800">
                {row.credit > 0 ? fmtMoney(row.credit) : '—'}
              </td>
              <td
                className={`whitespace-nowrap px-3 py-1.5 text-right tabular-nums ${
                  row.due < 0 ? 'text-red-600' : 'text-gray-800'
                }`}
              >
                {fmtMoney(row.due)}
              </td>
              <td className="whitespace-nowrap px-3 py-1.5 text-right font-semibold tabular-nums text-prominent-purple-900">
                {fmtMoney(row.outstanding)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-prominent-purple-100 bg-prominent-purple-50 font-semibold text-prominent-purple-900">
            <td className="px-3 py-2" colSpan={4}>
              Total
            </td>
            <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
              {fmtMoney(sum((r) => r.debit))}
            </td>
            <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
              {fmtMoney(sum((r) => r.credit))}
            </td>
            <td className="px-3 py-2" />
            <td className="px-3 py-2" />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
