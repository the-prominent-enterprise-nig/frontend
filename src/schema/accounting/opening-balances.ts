/** Which opening balance a file loads. */
export type OpeningKind = 'ap-bills' | 'cash-advances'

export type OpeningRowStatus = 'ok' | 'warning' | 'error'

export interface OpeningPreviewRow<D> {
  /** The spreadsheet row the message points at. */
  rowNumber: number
  status: OpeningRowStatus
  messages: string[]
  data: D
}

export interface OpeningPreview<D> {
  asOfDate: string
  /** The equity account the other side of every opening entry posts to. */
  offsetAccount: { id: string; label: string }
  summary: { total: number; ok: number; warnings: number; errors: number }
  /** Sum of the amounts that would be carried in. */
  totalAmount: number
  blockingErrors: boolean
  rows: OpeningPreviewRow<D>[]
}

export interface ApOpeningRowData {
  supplierCode: string
  supplierName: string | null
  invoiceNo: string
  invoiceDate: string | null
  dueDate: string | null
  description: string | null
  subtotal: number | null
  inputVat: number | null
  total: number | null
  withholding: number | null
  paid: number | null
  outstanding: number | null
}

export interface CashAdvanceOpeningRowData {
  date: string | null
  voucherNo: string | null
  employeeCode: string | null
  recipient: string
  branchName: string | null
  particulars: string | null
  amount: number | null
}

export type OpeningRowData = ApOpeningRowData | CashAdvanceOpeningRowData

export interface OpeningImportResult {
  created: number
  imported: number
  totalAmount: number
  asOfDate: string
}
