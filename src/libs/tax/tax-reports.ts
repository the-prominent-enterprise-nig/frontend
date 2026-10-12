import type {
  ExceptionKind,
  ExceptionModule,
  InputBucket,
  OutputBucket,
  TaxRowFlag,
} from '@/src/libs/data/TaxReportsData'

// Scenario 69 Part H — the words the tax report screens use, kept in one place
// so a bucket or a flag reads the same on the screen, in a tooltip and in the
// workbook the same report exports (the backend carries the same labels).

export const OUTPUT_BUCKET_LABEL: Record<OutputBucket, string> = {
  VATABLE: 'VATable sales',
  ZERO_RATED: 'Zero-rated sales',
  EXEMPT: 'VAT-exempt sales',
  OUT_OF_SCOPE: 'Out of scope',
  UNCLASSIFIED: 'Not classified',
}

export const INPUT_BUCKET_LABEL: Record<InputBucket, string> = {
  CLAIMABLE: 'Claimable Input VAT',
  CAPITAL: 'Capital goods',
  NON_VAT: 'Non-VAT purchase',
  EXEMPT: 'VAT-exempt purchase',
  OUT_OF_SCOPE: 'Out of scope',
  UNCODED: 'Not coded',
}

export type Tone = 'purple' | 'blue' | 'amber' | 'gray' | 'red' | 'green'

export const OUTPUT_BUCKET_TONE: Record<OutputBucket, Tone> = {
  VATABLE: 'purple',
  ZERO_RATED: 'blue',
  EXEMPT: 'amber',
  OUT_OF_SCOPE: 'gray',
  UNCLASSIFIED: 'red',
}

export const INPUT_BUCKET_TONE: Record<InputBucket, Tone> = {
  CLAIMABLE: 'purple',
  CAPITAL: 'blue',
  NON_VAT: 'gray',
  EXEMPT: 'amber',
  OUT_OF_SCOPE: 'gray',
  UNCODED: 'red',
}

// Scenario 69 Part I — the Tax Code Exception Report.
export const EXCEPTION_KIND_LABEL: Record<ExceptionKind, string> = {
  OVERRIDE: 'Tax code changed',
  NO_VAT_CLASS: 'No VAT class',
  NO_INPUT_CODE: 'No input VAT code',
  NO_WITHHOLDING_CODE: 'No withholding code',
}

export const EXCEPTION_KIND_TONE: Record<ExceptionKind, Tone> = {
  OVERRIDE: 'purple',
  NO_VAT_CLASS: 'red',
  NO_INPUT_CODE: 'amber',
  NO_WITHHOLDING_CODE: 'amber',
}

export const EXCEPTION_MODULE_LABEL: Record<ExceptionModule, string> = {
  POS: 'POS sale',
  AR_INVOICE: 'AR invoice',
  AP_BILL: 'AP bill',
  EXPENSE: 'Expense',
}

export const FLAG_LABEL: Record<TaxRowFlag, string> = {
  reversal: 'Reversal',
  no_document: 'No source document',
  variance: 'Document differs from ledger',
  unclassified: 'No VAT class',
  uncoded: 'No tax code on the line',
  missing_atc: 'No ATC',
  no_code: 'No tax code',
  missing_certificate: '2307 not received',
}

export const FLAG_TONE: Record<TaxRowFlag, Tone> = {
  reversal: 'gray',
  no_document: 'amber',
  variance: 'red',
  unclassified: 'red',
  uncoded: 'amber',
  missing_atc: 'amber',
  no_code: 'amber',
  missing_certificate: 'red',
}

/** Today's calendar date in Manila, YYYY-MM-DD: the day a tax period turns over. */
export function manilaToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(now)
}

const pad = (n: number) => String(n).padStart(2, '0')
const lastDayOf = (year: number, month0: number) =>
  new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate()
const ymd = (year: number, month0: number, day: number) => `${year}-${pad(month0 + 1)}-${pad(day)}`

export type PeriodPreset =
  | 'this-month'
  | 'last-month'
  | 'this-quarter'
  | 'last-quarter'
  | 'year-to-date'
  | 'custom'

export const PERIOD_PRESETS: { key: PeriodPreset; label: string }[] = [
  { key: 'this-month', label: 'This month' },
  { key: 'last-month', label: 'Last month' },
  { key: 'this-quarter', label: 'This quarter' },
  { key: 'last-quarter', label: 'Last quarter' },
  { key: 'year-to-date', label: 'Year to date' },
  { key: 'custom', label: 'Custom' },
]

/** The two dates a preset stands for, as of a day. A period never reaches past
 * today: the books only hold what has happened. */
export function presetPeriod(
  preset: Exclude<PeriodPreset, 'custom'>,
  today: string = manilaToday()
): { startDate: string; endDate: string } {
  const [y, m] = today.split('-').map(Number)
  const month0 = m - 1
  switch (preset) {
    case 'this-month':
      return { startDate: ymd(y, month0, 1), endDate: today }
    case 'last-month': {
      const py = month0 === 0 ? y - 1 : y
      const pm = month0 === 0 ? 11 : month0 - 1
      return { startDate: ymd(py, pm, 1), endDate: ymd(py, pm, lastDayOf(py, pm)) }
    }
    case 'this-quarter': {
      const q0 = Math.floor(month0 / 3) * 3
      return { startDate: ymd(y, q0, 1), endDate: today }
    }
    case 'last-quarter': {
      const q0 = Math.floor(month0 / 3) * 3
      const start = q0 === 0 ? { y: y - 1, m: 9 } : { y, m: q0 - 3 }
      return {
        startDate: ymd(start.y, start.m, 1),
        endDate: ymd(start.y, start.m + 2, lastDayOf(start.y, start.m + 2)),
      }
    }
    case 'year-to-date':
      return { startDate: ymd(y, 0, 1), endDate: today }
  }
}

/** The page a source document opens, when it has one. A POS sale has no page
 * of its own, so it is reached through its journal entry. */
export function documentHref(documentType: string, documentId: string | null): string | null {
  if (!documentId) return null
  if (documentType.startsWith('AR invoice')) return `/accounting/ar-invoices/${documentId}`
  switch (documentType) {
    case 'AP bill':
      return `/accounting/ap-bills/${documentId}`
    case 'Expense':
      return `/accounting/expenses/${documentId}`
    case 'Receiving report':
      return `/inventory/goods-receiving/${documentId}`
    case 'Manual receiving report':
      return `/accounting/receiving-reports/manual-rr/${documentId}`
    default:
      return null
  }
}

export const journalHref = (journalEntryId: string | null): string | null =>
  journalEntryId ? `/accounting/journal-entries/${journalEntryId}` : null

export const SETTLEMENT_TYPE_LABEL = {
  VAT_SETTLEMENT: 'VAT settlement',
  WHT_REMITTANCE: 'Withholding tax remittance',
} as const
