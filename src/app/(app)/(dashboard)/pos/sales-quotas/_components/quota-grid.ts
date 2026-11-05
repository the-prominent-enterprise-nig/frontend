import { cleanMoney } from '@/src/components/ui/MoneyInput'
import type { QuotaGridForm, SalesQuotaYear } from '@/src/schema/pos/sales-quotas'

/** Scenario 85 Part 4 — pure helpers behind the Sales Quotas grid. */

export const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

/** The loaded year as the form holds it: a plain-number string per cell. */
export function toFormCells(data: SalesQuotaYear): QuotaGridForm['cells'] {
  return Object.fromEntries(
    data.targets.map((t) => [
      t.key,
      (data.amounts[t.key] ?? Array(12).fill(null)).map((a) => (a === null ? '' : String(a))),
    ])
  )
}

export type QuotaEntry = { target: string; month: number; amount: number | null }

/** '1400000.50' and '1400000.5' are the same quota; '' is none. */
function normalise(value: string | undefined): string {
  return value ? String(Number(value)) : ''
}

/** Only the cells that differ from what was loaded — a blank cell clears its quota. */
export function changedEntries(
  loaded: QuotaGridForm['cells'],
  edited: QuotaGridForm['cells']
): QuotaEntry[] {
  return Object.entries(edited).flatMap(([target, cells]) =>
    cells.flatMap((value, i) => {
      const next = normalise(value)
      if (next === normalise(loaded[target]?.[i])) return []
      return [{ target, month: i + 1, amount: next === '' ? null : Number(next) }]
    })
  )
}

/** Sum of the given rows, month by month; null in a month nobody has a quota. */
export function sumRows(rows: string[][]): (number | null)[] {
  return Array.from({ length: 12 }, (_, i) => {
    const set = rows.map((r) => r[i]).filter((v) => v !== '' && v !== undefined)
    return set.length ? set.reduce((sum, v) => sum + Number(v), 0) : null
  })
}

export function rowTotal(cells: string[]): number | null {
  const set = cells.filter((v) => v !== '')
  return set.length ? set.reduce((sum, v) => sum + Number(v), 0) : null
}

/**
 * A block copied from Excel: rows split on newlines, cells on tabs, each
 * cleaned like a typed amount ("1,400,000" → "1400000"). Trailing empty line
 * (Excel adds one) dropped.
 */
export function parsePastedBlock(text: string): string[][] {
  const lines = text.replace(/\r/g, '').split('\n')
  if (lines.at(-1) === '') lines.pop()
  return lines.map((line) => line.split('\t').map((cell) => cleanMoney(cell)))
}

/**
 * Lays `block` onto the grid with its top-left at (row, month), over the
 * given row order. Cells that fall past December or the last row are dropped.
 */
export function applyPaste(
  cells: QuotaGridForm['cells'],
  rowKeys: string[],
  start: { row: number; month: number },
  block: string[][]
): QuotaGridForm['cells'] {
  const next = Object.fromEntries(Object.entries(cells).map(([k, v]) => [k, [...v]]))
  block.forEach((values, r) => {
    const key = rowKeys[start.row + r]
    if (!key) return
    values.forEach((value, c) => {
      const month = start.month + c
      if (month < 12) next[key][month] = value
    })
  })
  return next
}
