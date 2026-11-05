'use client'

import Tooltip from '@/src/components/ui/Tooltip'
import type { SalesByMonth, SalesByMonthRow } from '@/src/schema/pos/sales-reports'
import { money } from '../SalesStatCards'
import { longMonth, monthShade, shortMonth } from './month-format'

/**
 * Scenario 85 Part 3 — "Top models" / "Units by brand": one horizontal bar
 * per row, its length the units sold, split into month segments shaded light
 * (oldest) to dark (newest). Hovering a segment names its month and figures;
 * the month table beneath the panel is the same numbers in full.
 */

const BAR_ROWS = 10

export default function MonthBarsPanel({
  title,
  subtitle,
  data,
  loading,
}: {
  title: string
  subtitle: string
  data: SalesByMonth | undefined
  loading: boolean
}): React.JSX.Element {
  const rows = (data?.rows ?? []).slice(0, BAR_ROWS)
  const max = Math.max(1, ...rows.map(drawnUnits))

  return (
    <section
      aria-label={title}
      className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4"
    >
      <div>
        <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
        <p className="text-xs text-zinc-500">{subtitle}</p>
      </div>
      {data && data.months.length > 0 && <Legend months={data.months} />}

      {loading && <p className="py-8 text-center text-sm text-zinc-500">Loading…</p>}
      {!loading && rows.length === 0 && (
        <p className="py-8 text-center text-sm text-zinc-500">No sales for these filters.</p>
      )}

      <ul className="flex flex-col gap-3">
        {rows.map((row) => (
          <BarRow key={`${row.key}|${row.brand}`} row={row} months={data!.months} max={max} />
        ))}
      </ul>
    </section>
  )
}

/** A month a refund pushed below zero draws nothing; its figure is still in
 * the total on the right and in the table. */
function monthUnits(row: SalesByMonthRow): number[] {
  return row.perMonth.map((c) => Math.max(0, c.units))
}

function drawnUnits(row: SalesByMonthRow): number {
  return monthUnits(row).reduce((a, b) => a + b, 0)
}

function Legend({ months }: { months: string[] }): React.JSX.Element {
  return (
    <div className="flex items-center gap-2 text-[11px] text-zinc-500" aria-hidden>
      <span>{shortMonth(months[0])}</span>
      <span className="flex h-2 w-40 gap-px overflow-hidden rounded-sm">
        {months.map((m, i) => (
          <span key={m} className={`flex-1 ${monthShade(i, months.length)}`} />
        ))}
      </span>
      <span>{shortMonth(months[months.length - 1])}</span>
    </div>
  )
}

function BarRow({
  row,
  months,
  max,
}: {
  row: SalesByMonthRow
  months: string[]
  max: number
}): React.JSX.Element {
  const units = monthUnits(row)
  const drawn = drawnUnits(row)

  return (
    <li className="grid grid-cols-[minmax(7rem,9rem)_1fr_6.5rem] items-center gap-3">
      <span className="truncate text-xs font-medium text-zinc-800" title={row.key}>
        {row.key}
      </span>
      <span className="h-3 rounded-sm bg-zinc-100">
        {/* Bar length is the row's share of the longest; segments split it by month. */}
        <span
          className="flex h-full gap-[2px] overflow-visible"
          style={{ width: `${(drawn / max) * 100}%` }}
        >
          {units.map((u, i) =>
            u > 0 ? (
              <span key={months[i]} className="h-full" style={{ width: `${(u / drawn) * 100}%` }}>
                <Tooltip
                  label={`${longMonth(months[i])}: ${u} unit${u === 1 ? '' : 's'} · ${money(row.perMonth[i].gross)}`}
                  className="h-full w-full"
                >
                  <span
                    className={`block h-full w-full first:rounded-l-sm last:rounded-r-sm ${monthShade(i, months.length)}`}
                  />
                </Tooltip>
              </span>
            ) : null
          )}
        </span>
      </span>
      <span className="text-right">
        <span className="block text-xs font-semibold text-zinc-900 tabular-nums">
          {row.totalUnits.toLocaleString('en-PH')}
        </span>
        <span className="block text-[11px] text-zinc-500 tabular-nums">
          {money(row.totalGross)}
        </span>
      </span>
    </li>
  )
}
