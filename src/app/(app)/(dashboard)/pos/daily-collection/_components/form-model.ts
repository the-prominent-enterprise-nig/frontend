import type {
  CollectionKind,
  DailyCollectionReport,
  DailyCollectionRow,
} from '@/src/schema/pos/daily-collection'

/**
 * Scenario 53 Part 6 — the view model behind the printed Daily Collection
 * Report, kept beside the form component so the screen, the print sheet and
 * the exported workbook can be checked against one shape.
 *
 * Everything here mirrors the client's own paper form: a cash-only running
 * ledger whose SI#/CUSTOMER cell merges down a customer's several DESC lines,
 * a deposit line that credits the balance back to nil, a DESC-type subtotal
 * block and a denomination count. The service hands over cash rows only, so
 * nothing here has to filter by tender — the day's non-cash take arrives
 * pre-aggregated per provider, as its own block below the cash recap.
 */

/** `9-23-26` — the form's own date style, not ISO. */
export function formatFormDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return y && m && d ? `${Number(m)}-${Number(d)}-${y.slice(2)}` : iso
}

/** DESC as the client's form prints it: a part-payment is still MI there, a
 * full payment is FP, and a cancelled receipt has none. */
function formKind(row: DailyCollectionRow): string {
  if (row.cancelled) return ''
  return row.kind === 'MI-PARTIAL' ? 'MI' : row.kind
}

export function peso(amount: number): string {
  return Number(amount ?? 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/** Zero prints as the form's dash, not as `0.00`. */
export function pesoOrDash(amount: number | null): string {
  if (amount === null) return ''
  return Math.abs(amount) < 0.005 ? '-' : peso(amount)
}

export interface FormLine {
  type: 'collection' | 'deposit'
  si: string
  customer: string
  desc: string
  office: string
  field: string
  others: string
  cashInvoice: string
  ppd: number
  penalty: number
  debit: number | null
  credit: number | null
  balance: number | null
  /** Rows this line's SI#/CUSTOMER cell spans; 0 means "merged into the line
   * above", which is how one customer's DP and DC lines share a single name
   * cell on the paper form. */
  span: number
  /** Scenario 60 Part 4 — the caravan this sale's units came out of, if any. */
  caravan?: string
}

function collectionLines(report: DailyCollectionReport): {
  lines: FormLine[]
  running: number
} {
  let running = 0
  const lines = report.rows.map((r): FormLine => {
    running += r.amount
    return {
      type: 'collection',
      si: r.siNumber ?? '',
      customer: r.customerName,
      desc: formKind(r),
      office: r.channel === 'OFFICE' ? (r.crNumber ?? '') : '',
      field: r.channel === 'FIELD' ? (r.crNumber ?? '') : '',
      others: r.channel === 'OTHERS' ? (r.crNumber ?? '') : '',
      cashInvoice: r.cashInvoiceNumber ?? '',
      ppd: r.ppd,
      penalty: r.penalty,
      debit: r.amount,
      credit: null,
      balance: running,
      span: 1,
      caravan: r.caravan ?? undefined,
    }
  })
  return { lines, running }
}

/** Collapses each run of consecutive lines sharing an SI#/customer into one
 * merged cell, in place. */
function mergeCustomerRuns(lines: FormLine[]): void {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].span === 0) continue
    let run = 1
    while (
      i + run < lines.length &&
      lines[i + run].si === lines[i].si &&
      lines[i + run].customer === lines[i].customer
    ) {
      lines[i + run].span = 0
      run++
    }
    lines[i].span = run
  }
}

export function buildFormLines(report: DailyCollectionReport): FormLine[] {
  const { lines, running: afterCollections } = collectionLines(report)
  mergeCustomerRuns(lines)

  let running = afterCollections
  for (const d of report.deposits) {
    running -= d.amount
    lines.push({
      type: 'deposit',
      si: '',
      customer:
        `${d.bankName}${d.reference ? ` (${d.reference})` : ''} ${formatFormDate(d.depositedAt)}`.toUpperCase(),
      desc: '',
      office: '',
      field: '',
      others: '',
      cashInvoice: '',
      ppd: 0,
      penalty: 0,
      debit: null,
      credit: d.amount,
      balance: running,
      span: 1,
    })
  }
  return lines
}

export interface FooterLine {
  label: string
  /** The second label cell — OTHERS carries DC there. */
  sub?: string
  /** Highlighted yellow, as the client marks TOTAL COLLECTION. */
  highlight?: boolean
  /** Null on the blank spacer and on the NON-CASH COLLECTIONS heading, which
   * carry no figure of their own. */
  amount: number | null
  /** A deduction, printed in accounting parentheses. */
  negate: boolean
  emphasis: boolean
  /** Sits under a block heading — the non-cash tender lines. A flag rather
   * than padding in the label, since HTML collapses leading spaces. */
  indent?: boolean
}

/** Accounting parentheses for a deduction: `(4,720.00)`. */
export function footerAmount(line: FooterLine): string {
  if (line.amount === null) return ''
  return line.negate ? `(${peso(line.amount)})` : peso(line.amount)
}

/** Which line of the client's form a non-cash tender prints on. Mirrors the
 * backend's `bucketForTender` (src/pos/tender-key.ts); change one, change the
 * other. */
type TenderLine = 'GCASH' | 'CHECK' | 'CARD' | 'OTHER NON-CASH'

const TENDER_LINE_BY_METHOD: Record<string, TenderLine> = {
  qr: 'GCASH',
  gcash: 'GCASH',
  maya: 'GCASH',
  bank_transfer: 'GCASH',
  cheque: 'CHECK',
  check: 'CHECK',
  card: 'CARD',
}

function nonCashByLine(report: DailyCollectionReport): Record<TenderLine, number> {
  const totals: Record<TenderLine, number> = { GCASH: 0, CHECK: 0, CARD: 0, 'OTHER NON-CASH': 0 }
  for (const t of report.nonCash ?? []) {
    totals[TENDER_LINE_BY_METHOD[t.tender.split('::')[0]] ?? 'OTHER NON-CASH'] += t.amount
  }
  return totals
}

/**
 * The bottom-left block as the client's form has it (Alimodian sample,
 * 2026-09-23): COD, DP, MI (part-payments included), OTHERS with DC, the
 * highlighted TOTAL COLLECTION, then GCASH and CHECK. A card swipe or other
 * non-cash tender has no line on their form, so it gets one only on a day
 * that took some — never silently dropped. Mirrored by the backend's Excel
 * form sheet.
 */
export function buildCollectionRecapLines(report: DailyCollectionReport): FooterLine[] {
  const kind = (k: CollectionKind): number => report.byKind[k] ?? 0
  const nonCash = nonCashByLine(report)
  const line = (label: string, amount: number, extra: Partial<FooterLine> = {}): FooterLine => ({
    label,
    amount: amount || null,
    negate: false,
    emphasis: false,
    ...extra,
  })

  return [
    line('COD', kind('COD')),
    line('DP', kind('DP')),
    // A full payment (FP) is still an instalment collection: it counts here.
    line('MI', kind('MI') + kind('MI-PARTIAL') + kind('FP')),
    line('OTHERS', kind('DC'), { sub: 'DC' }),
    line('TOTAL COLLECTION', report.totalCollection, { emphasis: true, highlight: true }),
    line('GCASH', nonCash.GCASH),
    line('CHECK', nonCash.CHECK),
    ...(nonCash.CARD ? [line('CARD', nonCash.CARD)] : []),
    ...(nonCash['OTHER NON-CASH'] ? [line('OTHER NON-CASH', nonCash['OTHER NON-CASH'])] : []),
  ]
}

/**
 * Scenario 60 Part 4 — the caravans this branch hosted that day, printed under
 * the recap. Informational only: caravan sales ring up on this branch's
 * terminal, so the money is already in the lines above. Kept out of
 * `buildCollectionRecapLines` because the screen draws its own caravan block.
 */
export function buildCaravanRecapLines(report: DailyCollectionReport): FooterLine[] {
  if (report.caravanSales.length === 0) return []
  const blank = { negate: false, emphasis: false }
  return [
    { ...blank, label: '', amount: null },
    { ...blank, label: 'CARAVAN SALES (INCLUDED ABOVE)', amount: null, emphasis: true },
    ...report.caravanSales.map((c) => ({
      ...blank,
      label: `${c.caravanName} (${c.units} ${c.units === 1 ? 'unit' : 'units'})`,
      amount: c.amount,
      indent: true,
    })),
    { ...blank, label: 'CARAVAN TOTAL', amount: report.caravanSalesTotal, emphasis: true },
  ]
}

/** The form prints the full peso ladder whether or not a denomination turned
 * up in the drawer — a blank line is how the counter marks "none of these".
 * Exported because the editable form offers the same fixed set of rows. */
export const DENOMINATION_LADDER = ['1000', '500', '200', '100', '50', '20'] as const

export interface DenominationLine extends FooterLine {
  /** Null for COINS and the bridge lines, which carry an amount with no piece
   * count of their own. */
  count: number | null
  /** The draft key this line edits — a face value or 'coins'. Absent on the
   * derived lines (TOTAL and below). */
  face?: string
}

/**
 * The bottom-right block: the denomination count, then back out the opening
 * float to land on the cash actually collected.
 *
 * The count is taken at close, with the float still in the till and before the
 * cash is banked, so the float — not the deposit — is what stands between the
 * counted total and TOTAL COLLECTION at left. The two meet there: a gap is a
 * real cash over/short, not an artefact of the form.
 */
export function sumDenominations(counts: Record<string, number>): number {
  return Object.entries(counts).reduce(
    (sum, [face, value]) => (face === 'coins' ? sum + value : sum + Number(face) * value),
    0
  )
}

/**
 * Where the drawer stands against the day's cash collections.
 *
 * The count is taken with the float still in the till, so the float — not the
 * deposit — is what stands between the counted total and TOTAL COLLECTION
 * (CASH). Both the printed form and the screen's verdict read this, so the
 * two can never reach different conclusions about the same drawer.
 */
export interface CashPosition {
  /** Everything in the drawer at counting time, float included. */
  denominationTotal: number
  /** The drawer less the opening float — what the cash collections must meet. */
  cashCollected: number
  /** Positive is over, negative is short. */
  variance: number
  /** Within half a centavo, which is as close as a peso form can ask. */
  balanced: boolean
}

export function cashPosition(
  report: DailyCollectionReport,
  counts: Record<string, number> = report.denominations ?? {}
): CashPosition {
  const denominationTotal = sumDenominations(counts)
  const cashCollected = denominationTotal - report.openingFloat
  const variance = cashCollected - report.totalCollection

  return {
    denominationTotal,
    cashCollected,
    variance,
    balanced: Math.abs(variance) < 0.005,
  }
}

/**
 * @param counts overrides the report's own figures — what the cashier is
 * typing right now, so the TOTAL and CASH COLLECTED lines add up live rather
 * than only after a save.
 */
export function buildDenominationLines(
  report: DailyCollectionReport,
  counts: Record<string, number> = report.denominations ?? {}
): DenominationLine[] {
  const total = sumDenominations(counts)
  const extras = Object.keys(counts)
    .filter((k) => k !== 'coins' && !DENOMINATION_LADDER.includes(k as never))
    .sort((a, b) => Number(b) - Number(a))

  const notes = [...DENOMINATION_LADDER, ...extras].map((face): DenominationLine => {
    const count = counts[face] ?? 0
    return {
      label: face,
      face,
      count: count || null,
      amount: Number(face) * count,
      negate: false,
      emphasis: false,
    }
  })

  return [
    ...notes,
    {
      label: 'COINS',
      face: 'coins',
      count: null,
      amount: counts.coins ?? 0,
      negate: false,
      emphasis: false,
    },
    {
      label: 'TOTAL',
      count: null,
      amount: total,
      negate: false,
      emphasis: true,
    },
    {
      label: 'LESS: OPENING FLOAT',
      count: null,
      amount: report.openingFloat,
      negate: true,
      emphasis: false,
    },
    {
      label: 'CASH COLLECTED',
      count: null,
      amount: total - report.openingFloat,
      negate: false,
      emphasis: true,
    },
  ]
}

/**
 * The denomination block as the printed form carries it — the client's own
 * count, 1000 down to 20, the loose coins as one unlabelled amount, then
 * TOTAL. No float bridge: their form has none (Scenario 61, Alimodian
 * sample). The screen's totals panel keeps the full bridge from
 * `buildDenominationLines`.
 */
export function buildFormDenominationLines(
  report: DailyCollectionReport,
  counts?: Record<string, number>
): DenominationLine[] {
  const lines = buildDenominationLines(report, counts)
  const total = lines.findIndex((line) => line.label === 'TOTAL')
  return lines
    .slice(0, total + 1)
    .map((line) => (line.face === 'coins' ? { ...line, label: '' } : line))
}
