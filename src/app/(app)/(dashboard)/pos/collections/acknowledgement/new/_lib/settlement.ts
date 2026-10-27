export type ClearedType = 'SAME_DATE' | 'LATER_DATE' | 'PAST_DATE'

export const CLEARED_OPTIONS: { value: ClearedType; label: string }[] = [
  { value: 'SAME_DATE', label: 'Same date' },
  { value: 'LATER_DATE', label: 'Later date' },
  { value: 'PAST_DATE', label: 'Past date' },
]

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/** A field's text as a number; blank or unparseable counts as 0. */
export function toAmount(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0
  const n = typeof value === 'number' ? value : Number(String(value).replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

/**
 * The Net that reaches the bank: Gross − Subsidy − Withholding Tax.
 *
 * Both deductions are debits that stand in for cash — the subsidy goes to
 * Sales Discounts and Rebates, the withholding tax to Withholding Tax
 * Receivable (creditable withholding tax, which the customer paid to the BIR
 * on the company's behalf) — so each one lowers the cash received. This is the
 * one place the sign lives: the form, its journal preview and the backend's
 * own calculation must all agree with it.
 */
export function computeSettlementNet(gross: number, subsidy: number, withholding: number): number {
  return round2(gross - subsidy - withholding)
}

/** Today as YYYY-MM-DD in the user's own timezone. */
export function todayLocalIso(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Why the Cleared / Clear Date pair can't be saved, or null when it can.
 * Same date never carries a date; Later date's is optional (a later-clearing
 * payment can be recorded before the clearing date is known); Past date means
 * "already cleared", so it needs a date and that date can't be in the future.
 */
export function clearDateError(
  clearedType: ClearedType,
  clearedDate: string,
  today: string = todayLocalIso()
): string | null {
  if (clearedType !== 'PAST_DATE') return null
  if (!clearedDate) return 'Clear Date is required for a past-date receipt.'
  if (clearedDate > today) return 'Clear Date for a past-date receipt cannot be in the future.'
  return null
}

export type JournalPreviewLine = { side: 'Dr' | 'Cr'; label: string; amount: number }

/** The entry the receipt will post, as plain lines for the on-screen preview.
 * Account labels fall back to the account the backend uses when none is
 * picked. Lines with a zero amount are left out. */
export function buildJournalPreview(input: {
  net: number
  subsidy: number
  withholding: number
  gross: number
  cashLabel: string | null
  subsidyAccountLabel: string | null
  withholdingAccountLabel: string | null
  creditAccountLabel: string | null
}): JournalPreviewLine[] {
  const lines: JournalPreviewLine[] = []
  if (input.net > 0) {
    lines.push({ side: 'Dr', label: input.cashLabel || 'Cash', amount: input.net })
  }
  if (input.subsidy > 0) {
    lines.push({
      side: 'Dr',
      label: input.subsidyAccountLabel || 'Sales Discounts and Rebates (default)',
      amount: input.subsidy,
    })
  }
  if (input.withholding > 0) {
    lines.push({
      side: 'Dr',
      label: input.withholdingAccountLabel || 'Withholding Tax Receivable (default)',
      amount: input.withholding,
    })
  }
  if (input.gross > 0) {
    lines.push({
      side: 'Cr',
      label:
        input.creditAccountLabel ||
        'Other / Miscellaneous Collections (held until applied to the invoice)',
      amount: input.gross,
    })
  }
  return lines
}
