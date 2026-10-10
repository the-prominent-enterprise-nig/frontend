import { api } from '@/src/libs/api/client'
import type { TaxOverrideField } from '@/src/libs/tax/tax-override'

type Params = Record<string, string | number | boolean | undefined>
/** A query object as the API client's flat query-string params. */
const params = (q: object | undefined): Params | undefined => q as unknown as Params | undefined

// Scenario 69 Part H — the tax reports and the tax closing routines. These
// types mirror the backend's contract (src/accounting/tax-reports); the server
// decides every amount, so nothing here recomputes one.

export type OutputBucket = 'VATABLE' | 'ZERO_RATED' | 'EXEMPT' | 'OUT_OF_SCOPE' | 'UNCLASSIFIED'
export type InputBucket =
  | 'CLAIMABLE'
  | 'CAPITAL'
  | 'NON_VAT'
  | 'EXEMPT'
  | 'OUT_OF_SCOPE'
  | 'UNCODED'

export type TaxRowFlag =
  | 'reversal'
  | 'no_document'
  | 'variance'
  | 'unclassified'
  | 'uncoded'
  | 'missing_atc'
  | 'no_code'
  | 'missing_certificate'

export type TaxAccountKey =
  | 'OUTPUT_VAT'
  | 'INPUT_VAT'
  | 'VAT_PAYABLE'
  | 'WHT_PAYABLE'
  | 'WHT_PAYABLE_RENT'
  | 'WHT_PAYABLE_PROFESSIONAL'
  | 'WHT_RECEIVABLE'

/** The filters every report takes; each reads the ones that mean something to it. */
export interface TaxReportQuery {
  startDate: string
  endDate: string
  branchId?: string
  taxCode?: string
  customerId?: string
  supplierId?: string
  search?: string
  atc?: string
  certificateStatus?: 'pending' | 'received' | 'missing'
  certificateNo?: string
  invoiceNo?: string
  projectAssetRef?: string
  accountKey?: string
  /** Tax Code Exception Report: the module, the kind of exception and the user. */
  module?: string
  kind?: string
  userId?: string
}

export interface TaxReportMeta {
  startDate: string
  endDate: string
  branchId: string | null
  branchName: string | null
  /** True when the user is tied to a branch, so the limit is not theirs to lift. */
  branchLocked: boolean
  generatedAt: string
  rowCount: number
}

interface RowBase {
  journalEntryId: string | null
  journalRef: string
  date: string
  month: string
  documentType: string
  documentId: string | null
  documentNo: string | null
  invoiceNo: string | null
  branchId: string | null
  branchName: string
  flags: TaxRowFlag[]
  /** The closing routine that has cleared this row, if one has. */
  settledIn: string | null
}

export interface OutputVatRow extends RowBase {
  customerId: string | null
  customerName: string
  tin: string | null
  taxCode: string | null
  bucket: OutputBucket
  vatableSales: number
  zeroRatedSales: number
  exemptSales: number
  otherSales: number
  outputVat: number
  gross: number
  documentVat: number | null
  variance: number
}

export interface InputVatRow extends RowBase {
  supplierId: string | null
  supplierName: string
  tin: string | null
  lineNumber: number | null
  description: string | null
  taxCode: string | null
  bucket: InputBucket
  projectAssetRef: string | null
  base: number | null
  inputVat: number
  claimable: boolean
}

export interface EwtRow extends RowBase {
  supplierId: string | null
  supplierName: string
  tin: string | null
  taxCode: string | null
  atc: string | null
  ratePercent: number | null
  baseAmount: number | null
  withheld: number
  accountNumber: string
}

export interface CwtRow extends RowBase {
  paymentId: string | null
  customerId: string | null
  customerName: string
  tin: string | null
  collectionRef: string | null
  certificateNo: string | null
  certificateStatus: 'pending' | 'received' | null
  certificateDate: string | null
  certificateAmount: number | null
  atc: string | null
  taxPeriod: string | null
  taxableBase: number | null
  withheld: number
  varianceStatus: string | null
  daysOutstanding: number | null
}

export interface OutputSummaryRow {
  bucket: OutputBucket
  documents: number
  vatableSales: number
  zeroRatedSales: number
  exemptSales: number
  otherSales: number
  outputVat: number
  gross: number
}
export interface OutputVatReport {
  meta: TaxReportMeta
  summary: OutputSummaryRow[]
  rows: OutputVatRow[]
  totals: {
    rows: number
    vatableSales: number
    zeroRatedSales: number
    exemptSales: number
    otherSales: number
    outputVat: number
    gross: number
    variance: number
  }
}

export interface InputSummaryRow {
  bucket: InputBucket
  rows: number
  base: number
  inputVat: number
}
export interface InputVatReport {
  meta: TaxReportMeta
  summary: InputSummaryRow[]
  rows: InputVatRow[]
  totals: { rows: number; base: number; inputVat: number; claimable: number; variance: number }
}

export interface EwtSummaryRow {
  supplierId: string | null
  supplierName: string
  tin: string | null
  atc: string | null
  taxCode: string | null
  rows: number
  baseAmount: number
  withheld: number
}
export interface EwtReport {
  meta: TaxReportMeta
  summary: EwtSummaryRow[]
  rows: EwtRow[]
  totals: {
    rows: number
    withheld: number
    /** Null when the report is narrowed: a remittance pays the company's accounts as a whole. */
    remitted: number | null
    outstanding: number | null
    missingAtcRows: number
    missingAtcAmount: number
  }
}

export interface CwtSummaryRow {
  customerId: string | null
  customerName: string
  tin: string | null
  rows: number
  withheld: number
  pendingCount: number
  pendingAmount: number
  receivedAmount: number
}
export interface CwtReport {
  meta: TaxReportMeta
  summary: CwtSummaryRow[]
  rows: CwtRow[]
  totals: {
    rows: number
    withheld: number
    pendingCount: number
    pendingAmount: number
    receivedAmount: number
  }
}

export interface VatSettled {
  output: number
  input: number
  payable: number
}
export interface VatMonthRow {
  month: string
  label: string
  start: string
  end: string
  vatableSales: number
  zeroRatedSales: number
  exemptSales: number
  otherSales: number
  outputVat: number
  outputAdjustments: number
  inputVatClaimable: number
  inputVatCapital: number
  inputVatOther: number
  inputVat: number
  inputAdjustments: number
  netVat: number
  settled: VatSettled | null
}
export interface VatSummaryReport {
  meta: TaxReportMeta
  months: VatMonthRow[]
  total: Omit<VatMonthRow, 'month' | 'label' | 'start' | 'end'>
  /** The company's balances at the end of the period; null when narrowed. */
  unsettled: { output: number; input: number; net: number; payable: number } | null
  filters: { taxCode: string | null; settledShown: boolean }
}

export interface ReconciliationAccount {
  key: TaxAccountKey
  accountNumber: string
  accountName: string
  normalSide: 'DEBIT' | 'CREDIT'
  opening: number | null
  debits: number
  credits: number
  movement: number
  documents: number
  adjustments: number
  settlements: number
  unexplained: number
  variance: number
  varianceCount: number
  closing: number | null
  status: 'RECONCILED' | 'REVIEW'
}
export interface ReconciliationChecks {
  unclassifiedSales: { count: number; amount: number }
  uncodedPurchases: { count: number; amount: number }
  withholdingNoAtc: { count: number; amount: number }
  withholdingNoCode: { count: number; amount: number }
  certificatesPending: { count: number; amount: number }
  creditMemosAgainstVatableInvoices: { count: number; amount: number; impliedVat: number }
}
export interface ReconciliationReport {
  meta: TaxReportMeta
  accounts: ReconciliationAccount[]
  checks: ReconciliationChecks
}

// ── Tax Code Exception Report (Part I) ─────────────────────────────────────

export type ExceptionKind = 'OVERRIDE' | 'NO_VAT_CLASS' | 'NO_INPUT_CODE' | 'NO_WITHHOLDING_CODE'
export type ExceptionModule = 'POS' | 'AR_INVOICE' | 'AP_BILL' | 'EXPENSE'

export interface ExceptionRow {
  kind: ExceptionKind
  module: ExceptionModule
  documentType: string
  documentId: string
  documentNo: string | null
  /** The customer or supplier, or the payee. */
  party: string | null
  date: string
  branchId: string | null
  branchName: string
  /** Who changed the code; for a missing code, who created the document, when known. */
  userId: string | null
  userName: string | null
  field: TaxOverrideField | null
  line: number | null
  defaultCode: string | null
  chosenCode: string | null
  reason: string | null
  at: string | null
  approvedByName: string | null
  detail: string
  amount: number | null
}

/** A withholding tax code in force that has no ATC yet. */
export interface CodeWithoutAtc {
  code: string
  name: string
  taxType: string
  /** Null when the report is narrowed to a branch. */
  uses: number | null
  withheld: number | null
}

export interface ExceptionsReport {
  meta: TaxReportMeta
  summary: {
    byKind: { kind: ExceptionKind; count: number }[]
    byModule: { module: ExceptionModule; count: number }[]
    byUser: { userId: string | null; userName: string; count: number }[]
  }
  rows: ExceptionRow[]
  codesWithoutAtc: CodeWithoutAtc[]
  totals: { rows: number; documents: number }
}

export const TaxReports = {
  vatSummary: (q: TaxReportQuery) =>
    api.get<VatSummaryReport>('/reports/tax/vat-summary', params(q)),
  outputVat: (q: TaxReportQuery) => api.get<OutputVatReport>('/reports/tax/output-vat', params(q)),
  inputVat: (q: TaxReportQuery) => api.get<InputVatReport>('/reports/tax/input-vat', params(q)),
  ewtSchedule: (q: TaxReportQuery) => api.get<EwtReport>('/reports/tax/ewt-schedule', params(q)),
  cwtSchedule: (q: TaxReportQuery) => api.get<CwtReport>('/reports/tax/cwt-schedule', params(q)),
  reconciliation: (q: TaxReportQuery) =>
    api.get<ReconciliationReport>('/reports/tax/reconciliation', params(q)),
  exceptions: (q: TaxReportQuery) =>
    api.get<ExceptionsReport>('/reports/tax/exceptions', params(q)),
}

// ── Closing routines ───────────────────────────────────────────────────────

export type SettlementType = 'VAT_SETTLEMENT' | 'WHT_REMITTANCE'
export type SettlementStatus = 'POSTED' | 'REVERSED'

export interface ClosingLine {
  accountId: string
  number: string
  name: string
  debit: number
  credit: number
  description: string
}

interface AccountBalance {
  key: TaxAccountKey
  accountId: string
  number: string
  name: string
  /** Natural-side balance: credit-positive for a liability. */
  balance: number
}

export interface VatPreview {
  asOf: string
  output: AccountBalance | null
  input: AccountBalance | null
  payable: AccountBalance | null
  outputVat: number
  inputVat: number
  /** Output less Input: positive is payable, negative is creditable. */
  netPayable: number
  lines: ClosingLine[]
  lastSettledAsOf: string | null
  blockers: string[]
}

export interface WhtPreview {
  asOf: string
  accounts: AccountBalance[]
  lines: ClosingLine[]
  total: number
  overRemitted: AccountBalance[]
  lastRemittedAsOf: string | null
  blockers: string[]
}

export interface TaxSettlement {
  id: string
  settlementNumber: string
  type: SettlementType
  status: SettlementStatus
  asOfDate: string
  postingDate: string
  outputVat: number | null
  inputVat: number | null
  netAmount: number
  breakdown: ClosingLine[]
  bankAccountId: string | null
  bankName: string | null
  reference: string | null
  notes: string | null
  journalEntryId: string | null
  reversalJournalEntryId: string | null
  createdAt: string
  createdById: string | null
  createdByName: string | null
  reversedAt: string | null
  reversedById: string | null
  reversedByName: string | null
  reversalReason: string | null
  /** Only the latest run still in force can be undone. */
  canReverse: boolean
}

export interface SettlementEntry {
  id: string
  code: string
  date: string
  description: string
  lines: {
    accountNumber: string
    accountName: string
    description: string
    debit: number
    credit: number
  }[]
}
export interface TaxSettlementDetail extends TaxSettlement {
  entry: SettlementEntry | null
  reversalEntry: SettlementEntry | null
}

export const TaxClosing = {
  list: (q?: { type?: SettlementType; status?: SettlementStatus }) =>
    api.get<TaxSettlement[]>('/tax-closing', params(q)),
  get: (id: string) => api.get<TaxSettlementDetail>(`/tax-closing/${id}`),
  previewVat: (asOf: string) => api.get<VatPreview>('/tax-closing/preview/vat', { asOf }),
  previewWht: (asOf: string) => api.get<WhtPreview>('/tax-closing/preview/wht', { asOf }),
  settleVat: (body: { asOf: string; notes?: string }) =>
    api.post<TaxSettlementDetail>('/tax-closing/vat', body),
  remitWht: (body: {
    asOf: string
    paymentDate?: string
    bankAccountId: string
    reference?: string
    notes?: string
  }) => api.post<TaxSettlementDetail>('/tax-closing/wht', body),
  reverse: (id: string, reason: string) =>
    api.post<TaxSettlementDetail>(`/tax-closing/${id}/reverse`, { reason }),
}
