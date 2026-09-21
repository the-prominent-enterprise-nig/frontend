import { COLLECTION_KINDS, type DailyCollectionReport } from '@/src/schema/pos/daily-collection'

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

/** `09/08/26` — the form's own date style, not ISO. */
export function formatFormDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return y && m && d ? `${m}/${d}/${y.slice(2)}` : iso
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
      desc: r.kind,
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
      customer: `${d.bankName}${d.reference ? ` (${d.reference})` : ''} ${formatFormDate(d.depositedAt)}`,
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

/**
 * The bottom-left block: the client's DESC-type subtotals, then the bridge
 * from what was collected to what is still in the drawer, and below it the
 * non-cash block.
 *
 * Everything down to BALANCE (UNDEPOSITED) is cash, so TOTAL COLLECTION
 * (CASH) is what the denomination block must meet, and BALANCE (UNDEPOSITED)
 * is the same figure the ledger's BALANCE column ends on. Non-cash is kept
 * strictly below that chain — it was never in the drawer, so it cannot sit in
 * a figure the drawer has to prove — and adds the one thing the cash-only
 * form could never show: GRAND TOTAL COLLECTED.
 */
export function buildCollectionRecapLines(report: DailyCollectionReport): FooterLine[] {
  const line = (
    label: string,
    amount: number,
    opts: { negate?: boolean; emphasis?: boolean } = {}
  ): FooterLine => ({
    label,
    amount,
    negate: opts.negate ?? false,
    emphasis: opts.emphasis ?? false,
  })

  const nonCash = report.nonCash ?? []

  return [
    ...COLLECTION_KINDS.map((kind) => line(kind, report.byKind[kind] ?? 0)),
    line('TOTAL COLLECTION (CASH)', report.totalCollection, { emphasis: true }),
    line('LESS: DEPOSITED', report.totalDeposited, { negate: true }),
    line('BALANCE (UNDEPOSITED)', report.balance, { emphasis: true }),
    // A heading over nothing is worse than no heading: on a cash-only day the
    // form stays exactly the client's own cash-only form.
    ...(nonCash.length === 0
      ? []
      : [
          { label: '', amount: null, negate: false, emphasis: false },
          { label: 'NON-CASH COLLECTIONS', amount: null, negate: false, emphasis: true },
          ...nonCash.map((tender) => ({
            ...line(tender.label, tender.amount),
            indent: true,
          })),
          line('SUBTOTAL', report.nonCashCollection, { emphasis: true }),
          line('GRAND TOTAL COLLECTED', report.grandTotalCollection, { emphasis: true }),
        ]),
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
