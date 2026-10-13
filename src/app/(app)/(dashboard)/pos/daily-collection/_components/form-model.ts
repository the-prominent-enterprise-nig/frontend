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
 * Everything here mirrors the client's own paper form: a running ledger of
 * cash and non-cash sales (the BALANCE runs over every one of them) whose
 * SI#/CUSTOMER cell merges down a customer's several DESC lines,
 * credit lines that take the balance back to nil, a DESC-type subtotal
 * block and a denomination count. The service hands over cash and non-cash
 * rows separately; the day's non-cash take also arrives pre-aggregated per
 * provider, as its own block below the cash recap.
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
  /** What a credit line is, printed in the DATE cell: DEPOSIT, NON-CASH or
   * UNDEPOSITED. Empty on a collection line. */
  creditLabel: string
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
  /** The other counter this collection was taken at — a satellite office
   * filing under this branch. Absent on the branch's
   * own rows, so only a row whose cash is in another drawer carries a tag. */
  sourceCounter?: string
}

/**
 * Every collection of the day as ledger lines, in the order the branch took
 * the money — cash and non-cash together.
 *
 * The report splits `rows` (cash) from `nonCashRows` for its TOTALS, which are
 * cash-only by design. The ledger does not want that split: a customer who
 * paid by card belongs where they actually paid, not in a separate block
 * after everyone who paid cash. So the two come back together here and sort
 * by timestamp.
 *
 * The running BALANCE moves on every line, cash or not, at any counter — the
 * credit lines below the collections (`creditLines`) are what bring it back
 * to nil, so the CREDIT column balances the DEBIT column.
 */
function collectionLines(report: DailyCollectionReport): {
  lines: FormLine[]
  running: number
} {
  let running = 0
  const ordered = [...report.rows, ...(report.nonCashRows ?? [])].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  )
  const lines = ordered.map((r): FormLine => {
    running += r.amount
    return {
      type: 'collection',
      creditLabel: '',
      si: r.siNumber ?? '',
      customer: r.customerName,
      desc: formKind(r),
      // Three separate facts under CASH RECEIPT: the booklet number, who
      // collected it in the field, and — under OTHERS — when the cash is in
      // another drawer, the counter that took it. These used to be one receipt number routed into
      // whichever of the three matched the row's channel, which left two
      // blank on every row.
      office: r.crNumber ?? '',
      field: r.collectorLabel ?? '',
      others: r.sourceCounter ?? '',
      cashInvoice: r.cashInvoiceNumber ?? '',
      ppd: r.ppd,
      penalty: r.penalty,
      debit: r.amount,
      credit: null,
      balance: running,
      span: 1,
      sourceCounter: r.sourceCounter ?? undefined,
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
  const { lines, running } = collectionLines(report)
  mergeCustomerRuns(lines)
  return [...lines, ...creditLines(report, running)]
}

/**
 * The CREDIT column, entered until the running balance is nil, as the
 * client's form closes a day: one line per deposit — the bank and the date it
 * was banked — then whatever is left as UNDEPOSITED. Each line carries the balance as
 * it stands after it.
 */
function creditLines(report: DailyCollectionReport, opening: number): FormLine[] {
  let running = opening
  const lines = report.deposits.map((d) => {
    running -= d.amount
    const text = `${d.bankName} ${formatFormDate(d.depositedAt)}`
    return creditLine('DEPOSIT', text, d.amount, running)
  })
  if (running > 0.005) lines.push(creditLine('UNDEPOSITED', 'UNDEPOSITED FUNDS', running, 0))
  return lines
}

function creditLine(label: string, text: string, credit: number, balance: number): FormLine {
  return {
    type: 'deposit',
    creditLabel: label,
    si: '',
    customer: text.toUpperCase(),
    desc: '',
    office: '',
    field: '',
    others: '',
    cashInvoice: '',
    ppd: 0,
    penalty: 0,
    debit: null,
    credit,
    balance,
    span: 1,
  }
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
  /** The on-screen explanation of the label. The printed form ignores it. */
  note?: string
  /** Which part of the recap this line belongs to, for the screen panel,
   * which groups what the paper form prints as one column. The printed form
   * and the Excel export ignore it and keep the client's own flat order.
   *
   * `placement` is a line that says where the cash is rather than what kind
   * of collection it was — the screen shows those together in their own
   * group, so it draws them from the report directly and skips them here. */
  group?: 'cash' | 'placement'
}

/** Accounting parentheses for a deduction: `(4,720.00)`. */
export function footerAmount(line: FooterLine): string {
  if (line.amount === null) return ''
  return line.negate ? `(${peso(line.amount)})` : peso(line.amount)
}

/** The day's collections per DESC kind, cash and non-cash together — the
 * ledger's own debits, so the recap is a rundown of exactly what it lists.
 * `byKind` on the report is cash-only and cannot be used for this. */
function kindTotals(report: DailyCollectionReport): Map<CollectionKind, number> {
  const totals = new Map<CollectionKind, number>()
  for (const r of [...report.rows, ...(report.nonCashRows ?? [])]) {
    totals.set(r.kind, (totals.get(r.kind) ?? 0) + r.amount)
  }
  return totals
}

/** Names only what the day's OTHERS line actually holds. */
function othersNote(deliveryCharges: number, newReceipts: number): string | undefined {
  const hasDc = Math.abs(deliveryCharges) > 0.005
  const hasNr = Math.abs(newReceipts) > 0.005
  if (hasDc && hasNr) return 'Delivery charges and new receipts'
  if (hasDc) return 'Delivery charges'
  if (hasNr) return 'New receipts'
  return undefined
}

/**
 * The bottom-left block as the client's form has it (Alimodian sample,
 * 2026-09-23): COD, DP, MI (part-payments included), OTHERS with DC, then the
 * highlighted TOTAL COLLECTION — every collection of the day, cash or not.
 * The non-cash providers are not itemised here: the ledger's CREDIT column
 * already names each bank they were banked to.
 */
export function buildCollectionRecapLines(report: DailyCollectionReport): FooterLine[] {
  const totals = kindTotals(report)
  const kind = (k: CollectionKind): number => totals.get(k) ?? 0
  const line = (label: string, amount: number, extra: Partial<FooterLine> = {}): FooterLine => ({
    label,
    amount: amount || null,
    negate: false,
    emphasis: false,
    ...extra,
  })

  return [
    line('COD', kind('COD'), { group: 'cash' }),
    line('DP', kind('DP'), { group: 'cash' }),
    // A first instalment (FMI) and a full payment (FP) are still instalment
    // collections: they count here.
    line('MI', kind('MI') + kind('FMI') + kind('MI-PARTIAL') + kind('FP'), {
      group: 'cash',
    }),
    // DC and the day's New Receipts (Scenario 70 G3) share the client's own
    // OTHERS line — neither settles a sale or a due.
    line('OTHERS', kind('DC') + kind('OTHERS'), {
      sub: 'DC',
      note: othersNote(kind('DC'), kind('OTHERS')),
      group: 'cash',
    }),
    line(
      'TOTAL COLLECTION',
      [...totals.values()].reduce((sum, v) => sum + v, 0),
      {
        emphasis: true,
        highlight: true,
        group: 'cash',
      }
    ),
    // Mirrors the backend form sheet's own line (daily-collection.form-sheet.ts)
    // — this recap and that one must never print different figures for the
    // same day. Only drawn while a session is still open, so a final form is
    // unchanged; the signed denomination count can only cover the settled
    // part, and without this line the gap reads as a shortage.
    ...(report.pendingCashOnHand > 0.005
      ? [
          line('NOT YET COUNTED (open drawers)', report.pendingCashOnHand, {
            sub: 'incl. float',
            group: 'placement',
          }),
        ]
      : []),
    // Cash another counter took — a satellite office filing under this branch
    // (Branch.reportsToBranchId). Same reason as the line above: it is in
    // TOTAL COLLECTION but not in this drawer, so without it the count reads
    // as a shortage. One named row each, which needs no heading and no
    // collective noun — the client's own data uses "satellite" for something
    // else (the `_Satellite` sub-locations in the Item Master).
    ...report.offsiteCash.map((c) => line(`At ${c.name}`, c.amount, { group: 'placement' })),
  ]
}

/**
 * The recap with its empty rows dropped — for the SCREEN panel only.
 *
 * `line()` maps 0 to null, so a tender the branch never took renders as a row
 * of dashes (GCASH —, CHECK —, a bank with nothing on it). On the screen that
 * is just noise. On the printed form and the Excel export it is NOT: GCASH and
 * CHECK are pre-printed rows on the client's own form and have to appear even
 * blank, which is why the filter lives here rather than in the builder both
 * renderers share.
 *
 * Emphasised and highlighted lines always survive: TOTAL COLLECTION reading
 * 0.00 is a fact about the day, not an empty row.
 */
export function withValuesOnly(lines: FooterLine[]): FooterLine[] {
  return lines.filter((l) => l.emphasis || l.highlight || l.amount !== null)
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
 * deposit — is what stands between the counted total and the SETTLED cash
 * collection. Both the printed form and the screen's verdict read this, so
 * the two can never reach different conclusions about the same drawer.
 *
 * Measured against settled cash, NOT TOTAL COLLECTION: since 2026-10-09 the
 * report carries sales from sessions that are still open, and those drawers
 * have not been counted. Comparing the count to a total that includes them
 * would report every open session as a cash short that is not real.
 */
export interface CashPosition {
  /** Everything in the drawer at counting time, float included. */
  denominationTotal: number
  /** The drawer less the opening float — what the SETTLED cash collection
   * must meet. */
  cashCollected: number
  /** Positive is over, negative is short. Against settled cash only. */
  variance: number
  /** Cash taken on still-open sessions, with no count behind it yet. Shown
   * beside the verdict so the reader knows the reconciliation is partial;
   * zero once the day's sessions have all closed. */
  pendingCashOnHand: number
  /** Within half a centavo, which is as close as a peso form can ask. */
  balanced: boolean
}

export function cashPosition(
  report: DailyCollectionReport,
  counts: Record<string, number> = report.denominations ?? {}
): CashPosition {
  const denominationTotal = sumDenominations(counts)
  const cashCollected = denominationTotal - report.openingFloat
  const variance = cashCollected - report.settledCashCollection

  return {
    denominationTotal,
    cashCollected,
    variance,
    pendingCashOnHand: report.pendingCashOnHand,
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
    ...withVariance(report, counts),
  ]
}

function withVariance(
  report: DailyCollectionReport,
  counts: Record<string, number>
): DenominationLine[] {
  const variance = cashVarianceLine(report, counts)
  return variance ? [variance] : []
}

/**
 * The denomination block as the printed form carries it — the client's own
 * count, 1000 down to 20, the loose coins as one unlabelled amount, then
 * TOTAL, then the drawer's over/short. No float bridge: their form has none
 * (Scenario 61, Alimodian sample). The screen's totals panel keeps the full
 * bridge from `buildDenominationLines`.
 */
export function buildFormDenominationLines(
  report: DailyCollectionReport,
  counts?: Record<string, number>
): DenominationLine[] {
  const lines = buildDenominationLines(report, counts)
  const total = lines.findIndex((line) => line.label === 'TOTAL')
  return [
    ...lines
      .slice(0, total + 1)
      .map((line) => (line.face === 'coins' ? { ...line, label: '' } : line)),
    ...withVariance(report, counts ?? report.denominations ?? {}),
  ]
}

/**
 * CASH VARIANCE under the count — on screen and on paper — from the same
 * `cashPosition` the screen's verdict reads — and the same wording and rule as
 * the server's exported form sheet. Absent while nothing has closed: with no
 * counted drawer the gap is the whole day's take, not a variance.
 */
function cashVarianceLine(
  report: DailyCollectionReport,
  counts?: Record<string, number>
): DenominationLine | null {
  if (report.openSessionCount > 0 && report.settledCashCollection < 0.005) return null
  const { variance, balanced } = cashPosition(report, counts)
  if (balanced) return null
  // Signed, as the Excel export carries it: positive over, negative short.
  return {
    label: 'CASH VARIANCE',
    count: null,
    amount: Math.round(variance * 100) / 100,
    negate: false,
    emphasis: true,
  }
}
