/** Bulk upload of acknowledgement / collection receipts — the shapes the
 * backend's `/accounting/acknowledgement-receipts/import[/preview]` endpoints
 * hand back. The preview writes nothing; the commit posts every row in one go
 * (all rows or none). */

export type AcknowledgementImportRowStatus = 'ok' | 'warning' | 'error'

export interface AcknowledgementImportRowData {
  receiptType: string
  branchName: string | null
  paymentDate: string
  reference: string | null
  clearedType: string
  clearedDate: string | null
  customerName: string | null
  invoiceNo: string | null
  bankAccountName: string | null
  description: string | null
  grossAmount: number
  subsidyAmount: number
  subsidyAccountLabel: string | null
  withholdingAmount: number
  withholdingAccountLabel: string | null
  /** The Net the file carried; null when the cell was blank. */
  uploadedNet: number | null
  /** Gross − Subsidy − Withholding, the Net that will actually post. */
  calculatedNet: number
  /** uploadedNet − calculatedNet, or null when no Net was uploaded. */
  netDifference: number | null
}

/** A row's raw, editable values — exactly what the CSV cell held, all strings,
 * '' for blank. Keys: receiptType, branch, date, reference, cleared, clearDate,
 * customer, invoiceNo, receivedIn, description, gross, subsidy, subsidyAccount,
 * withholding, withholdingAccount, net (the backend may add `account`, which
 * this screen ignores). */
export type AcknowledgementImportCells = Record<string, string>

/** The cell keys the review screen edits, in the order it shows them. */
export const IMPORT_CELL_KEYS = [
  'receiptType',
  'branch',
  'date',
  'reference',
  'cleared',
  'clearDate',
  'customer',
  'invoiceNo',
  'receivedIn',
  'description',
  'gross',
  'subsidy',
  'subsidyAccount',
  'withholding',
  'withholdingAccount',
  'net',
] as const

export interface AcknowledgementImportRow {
  /** The CSV's spreadsheet row. Stable — kept on every preview call, even
   * after rows above it are removed. */
  rowNumber: number
  status: AcknowledgementImportRowStatus
  messages: string[]
  /** The customer name matched nobody — it will be created on commit. */
  newCustomer: boolean
  data: AcknowledgementImportRowData
  cells: AcknowledgementImportCells
}

/** What the row-based endpoints take: the editable values, keyed by the same
 * spreadsheet row number the file preview reported. */
export interface AcknowledgementImportRowInput {
  rowNumber: number
  cells: AcknowledgementImportCells
}

export interface AcknowledgementImportPreview {
  summary: { total: number; ok: number; warnings: number; errors: number }
  /** True when any row is an error — the file has to be fixed and re-uploaded. */
  blockingErrors: boolean
  rows: AcknowledgementImportRow[]
}

/** What a committed import reports back. Only the count is relied on. */
export interface AcknowledgementImportResult {
  imported: number
  /** The row-based commit also reports the same count as `created`. */
  created?: number
  customersCreated?: number
}

/** The summary line for a set of rows — used when rows are dropped on screen
 * before the server has re-checked the rest. */
export function summarizeImportRows(
  rows: readonly Pick<AcknowledgementImportRow, 'status'>[]
): AcknowledgementImportPreview['summary'] {
  return {
    total: rows.length,
    ok: rows.filter((r) => r.status === 'ok').length,
    warnings: rows.filter((r) => r.status === 'warning').length,
    errors: rows.filter((r) => r.status === 'error').length,
  }
}

/** A row whose message says the uploaded Net disagrees with the calculated
 * one. The backend words these "Net differs by …". */
export function isNetMismatchRow(row: AcknowledgementImportRow): boolean {
  return row.messages.some((m) => m.startsWith('Net differs by'))
}
