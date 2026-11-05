'use client'

import type { SalesByMonth } from '@/src/schema/pos/sales-reports'
import { money } from '../SalesStatCards'

/**
 * Scenario 85 Part 3 — "Top models by month" / "Brands by month": one row per
 * model (or brand), one column per month with units over the amount, and a
 * Grand total row over every row, not just those shown. "Show all N" lifts the
 * top-10 cut.
 */
export default function MonthTablePanel({
  title,
  keyHeader,
  showBrand,
  data,
  loading,
  showAll,
  onShowAll,
}: {
  title: string
  keyHeader: string
  showBrand: boolean
  data: SalesByMonth | undefined
  loading: boolean
  showAll: boolean
  onShowAll: (next: boolean) => void
}): React.JSX.Element {
  const rows = data?.rows ?? []
  const months = data?.months ?? []
  const lead = showBrand ? 3 : 2

  return (
    <section
      aria-label={title}
      className="flex min-w-0 flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 lg:col-span-2"
    >
      <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
      <div className="overflow-x-auto rounded-lg border border-zinc-200">
        <table className="w-full min-w-max text-xs">
          <thead className="bg-zinc-50 text-[11px] tracking-wide text-zinc-500 uppercase">
            <tr>
              <th scope="col" className="sticky left-0 bg-zinc-50 px-3 py-2 text-left">
                #
              </th>
              <th scope="col" className="sticky left-8 bg-zinc-50 px-3 py-2 text-left">
                {keyHeader}
              </th>
              {showBrand && (
                <th scope="col" className="px-3 py-2 text-left">
                  Brand
                </th>
              )}
              {months.map((m) => (
                <th key={m} scope="col" className="px-3 py-2 text-right">
                  {m}
                </th>
              ))}
              <th scope="col" className="px-3 py-2 text-right">
                Total
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {(loading || rows.length === 0) && (
              <tr>
                <td
                  colSpan={lead + months.length + 1}
                  className="px-4 py-8 text-center text-zinc-500"
                >
                  {loading ? 'Loading…' : 'No sales for these filters.'}
                </td>
              </tr>
            )}
            {rows.map((row, i) => (
              <tr key={`${row.key}|${row.brand}`} className="hover:bg-zinc-50">
                <td className="sticky left-0 bg-white px-3 py-1.5 text-zinc-500 tabular-nums">
                  {i + 1}
                </td>
                <td className="sticky left-8 bg-white px-3 py-1.5 font-medium whitespace-nowrap text-zinc-900">
                  {row.key}
                </td>
                {showBrand && <td className="px-3 py-1.5 text-zinc-600">{row.brand}</td>}
                {row.perMonth.map((c, j) => (
                  <Cell key={months[j]} units={c.units} gross={c.gross} />
                ))}
                <Cell units={row.totalUnits} gross={row.totalGross} strong />
              </tr>
            ))}
          </tbody>
          {data && rows.length > 0 && (
            <tfoot className="border-t-2 border-zinc-200 bg-zinc-50">
              <tr>
                <td className="sticky left-0 bg-zinc-50" />
                <td className="sticky left-8 bg-zinc-50 px-3 py-2 font-semibold text-zinc-900">
                  Grand total
                </td>
                {showBrand && <td />}
                {data.grandTotal.perMonth.map((c, j) => (
                  <Cell key={months[j]} units={c.units} gross={c.gross} strong />
                ))}
                <Cell
                  units={data.grandTotal.totalUnits}
                  gross={data.grandTotal.totalGross}
                  strong
                />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {data && data.rowCount > 10 && (
        <button
          type="button"
          onClick={() => onShowAll(!showAll)}
          className="self-start rounded-lg px-2 py-1 text-xs font-medium text-prominent-purple-700 hover:bg-prominent-purple-50"
        >
          {showAll ? 'Show top 10' : `Show all ${data.rowCount}`}
        </button>
      )}
    </section>
  )
}

function Cell({
  units,
  gross,
  strong = false,
}: {
  units: number
  gross: number
  strong?: boolean
}): React.JSX.Element {
  if (!units && !gross) return <td className="px-3 py-1.5" />
  return (
    <td className="px-3 py-1.5 text-right tabular-nums">
      <span className={`block ${strong ? 'font-semibold' : 'font-medium'} text-zinc-900`}>
        {units.toLocaleString('en-PH')}
      </span>
      <span className="block text-[11px] text-zinc-500">{money(gross)}</span>
    </td>
  )
}
