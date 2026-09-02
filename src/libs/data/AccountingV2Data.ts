import { api } from '@/src/libs/api/client'

// ============ Fixed Assets v2 (ACC-21) ============
export type DepreciationMethod = 'STRAIGHT_LINE' | 'DECLINING_BALANCE' | 'UNITS_OF_PRODUCTION'
export type FixedAssetStatus = 'ACTIVE' | 'DISPOSED'
export type FixedAssetHistoryType =
  | 'ACQUIRED'
  | 'DEPRECIATION'
  | 'REVALUATION'
  | 'TRANSFER'
  | 'DISPOSAL'
export interface FixedAssetV2 {
  id: string
  assetCode: string
  name: string
  description?: string | null
  category?: string | null
  acquisitionDate: string
  acquisitionCost: number
  salvageValue: number
  usefulLifeMonths: number
  depreciationMethod: DepreciationMethod
  decliningBalanceRate?: number | null
  totalProductionUnits?: number | null
  unitsProducedToDate: number
  accumulatedDepreciation: number
  bookValue: number
  status: FixedAssetStatus
  disposalDate?: string | null
  disposalProceeds?: number | null
  disposalGainLoss?: number | null
  assetAccountId?: string | null
  accumulatedDepAccountId?: string | null
  depreciationExpenseAccountId?: string | null
  costCenter?: string | null
  lastDepreciationDate?: string | null
  history?: FixedAssetHistoryRecord[]
}
export interface FixedAssetHistoryRecord {
  id: string
  fixedAssetId: string
  type: FixedAssetHistoryType
  occurredAt: string
  amount?: number | null
  description?: string | null
  journalEntryId?: string | null
  performedBy?: string | null
  metadata?: unknown
}
export interface DepreciationRunResult {
  processed: number
  totalDepreciation: number
  journalEntryId: string | null
  results: { assetId: string; assetCode?: string; amount: number; skipped?: boolean }[]
}
export const FixedAssetsV2 = {
  list: () => api.get<FixedAssetV2[]>('/fixed-assets'),
  get: (id: string) => api.get<FixedAssetV2>(`/fixed-assets/${id}`),
  history: (id: string) => api.get<FixedAssetHistoryRecord[]>(`/fixed-assets/${id}/history`),
  create: (body: Partial<FixedAssetV2>) => api.post<FixedAssetV2>('/fixed-assets', body),
  update: (id: string, body: Partial<FixedAssetV2>) =>
    api.patch<FixedAssetV2>(`/fixed-assets/${id}`, body),
  runDepreciation: (body: {
    mode?: 'MONTHLY' | 'ANNUAL'
    unitsByAssetId?: Record<string, number>
    asOfDate?: string
  }) => api.post<DepreciationRunResult>('/fixed-assets/run-depreciation', body),
  dispose: (id: string, body: { proceeds: number; disposalDate?: string }) =>
    api.post<{ asset: FixedAssetV2; journalEntryId: string; gainLoss: number }>(
      `/fixed-assets/${id}/dispose`,
      body
    ),
  remove: (id: string) => api.delete(`/fixed-assets/${id}`),
}

// ============ Installment Interest Release (Scenario 29 ACC-04) ============
export interface PendingInterestReleaseSchedule {
  installmentScheduleId: string
  transactionNumber?: string | null
  periodsEligible: number
  amount: number
}
export interface PendingInterestReleaseResult {
  asOfDate: string
  schedules: PendingInterestReleaseSchedule[]
  totalPending: number
}
export interface InterestReleaseRunResultItem {
  installmentScheduleId: string
  journalEntryId: string
  periodsReleased: number
  amountReleased: number
}
export interface InterestReleaseRunResult {
  asOfDate: string
  schedulesReleased: number
  totalReleased: number
  results: InterestReleaseRunResultItem[]
  skipped: { installmentScheduleId: string; reason: string }[]
}
export const InstallmentInterestRelease = {
  getPending: (asOfDate?: string) =>
    api.get<PendingInterestReleaseResult>('/accounting/installment-interest-release/pending', {
      asOfDate,
    }),
  run: (body: { asOfDate?: string }) =>
    api.post<InterestReleaseRunResult>('/accounting/installment-interest-release/run', body),
}

// ============ Budgets (ACC-23) ============
export type BudgetGrain = 'MONTHLY' | 'QUARTERLY' | 'ANNUAL'
export interface Budget {
  id: string
  accountId: string
  account?: { id: string; number?: string; name: string; type?: string }
  departmentId?: string | null
  branchId?: string | null
  project?: string | null
  grain: BudgetGrain
  fiscalYear: number
  periodIndex?: number | null
  budgetedAmount: number
  warnThresholdPercent?: number | null
  alertThresholdPercent?: number | null
  ownerEmail?: string | null
  notes?: string | null
}
export interface VarianceRow {
  budgetId: string
  account: { id: string; number?: string; name: string; type?: string } | null
  departmentId?: string | null
  branchId?: string | null
  project?: string | null
  grain: BudgetGrain
  fiscalYear: number
  periodIndex?: number | null
  budgetedAmount: number
  actual: number
  variance: number
  variancePct: number | null
  usedPct: number | null
  forecastFullYear: number | null
  warnTriggered: boolean
  alertTriggered: boolean
  transactionCount: number
}
export const Budgets = {
  list: (params?: {
    fiscalYear?: number
    departmentId?: string
    branchId?: string
    accountId?: string
  }) => api.get<Budget[]>('/budgets', params as any),
  variance: (
    fiscalYear: number,
    params?: { grain?: BudgetGrain; departmentId?: string; branchId?: string }
  ) => api.get<VarianceRow[]>('/budgets/variance-report', { fiscalYear, ...(params as any) }),
  create: (body: Partial<Budget>) => api.post<Budget>('/budgets', body),
  update: (id: string, body: Partial<Budget>) => api.patch<Budget>(`/budgets/${id}`, body),
  remove: (id: string) => api.delete(`/budgets/${id}`),
}

// ============ Cash Forecast (ACC-24) ============
export interface CashFlowEntry {
  source: string
  amount: number
  description?: string
}
export interface ForecastWeek {
  weekStart: string
  weekEnd: string
  label: string
  opening: number
  inflows: CashFlowEntry[]
  outflows: CashFlowEntry[]
  totalIn: number
  totalOut: number
  closing: number
}
export interface CashForecastResult {
  generatedAt: string
  horizonWeeks: number
  assumptions: { openingBalance: number; arDelayDays: number; apAccelerateDays: number }
  weeks: ForecastWeek[]
}
export const CashForecast = {
  get: (params?: {
    weeks?: number
    openingBalance?: number
    arDelayDays?: number
    apAccelerateDays?: number
    startDate?: string
  }) => api.get<CashForecastResult>('/cash-forecast', params as any),
}

// ============ Reports ============
export const Reports = {
  trialBalance: (asOf?: string) =>
    api.get<any>('/reports/trial-balance', asOf ? { asOf } : undefined),
  // SCEN-14 Closing Gap 2: optional branchId scopes the P&L to one branch's
  // posted journal entries instead of aggregating company-wide.
  // SCEN-14 Closing Gap 3: view:'internal' excludes adjusting/eliminating
  // entries (raw management figures); view:'net' (default) includes them.
  pnl: (startDate: string, endDate: string, branchId?: string, view?: 'internal' | 'net') =>
    api.get<any>('/reports/profit-and-loss', {
      startDate,
      endDate,
      ...(branchId && { branchId }),
      ...(view && { view }),
    }),
  balanceSheet: (asOf?: string) =>
    api.get<any>('/reports/balance-sheet', asOf ? { asOf } : undefined),
  generalLedger: (params: { accountId?: string; startDate?: string; endDate?: string }) =>
    api.get<any>('/reports/general-ledger', params as any),
  cashFlow: (startDate: string, endDate: string) =>
    api.get<any>('/reports/cash-flow', { startDate, endDate }),
  aging: (type: 'ar' | 'ap', asOf?: string) =>
    api.get<any>(`/reports/aging/${type}`, asOf ? { asOf } : undefined),
  // Scenario 36 Gap 2 — receipts already posted to the GL but not yet
  // matched to a supplier bill/invoice.
  grni: () => api.get<any>('/reports/grni'),
  // Scenario 36 Gap 11 — every receiving report, matched or not (unlike
  // GRNI above) — Accounting had no way to browse these at all before this.
  receivingReports: () => api.get<any>('/reports/receiving-reports'),
  receivingReportDocument: (id: string) =>
    api.get<any>(`/reports/receiving-reports/${id}/document`),
  customerStatement: (id: string) => api.get<any>(`/reports/customer-statement/${id}`),
  supplierStatement: (id: string) => api.get<any>(`/reports/supplier-statement/${id}`),
  biSummary: () => api.get<any>('/reports/bi-summary'),
  // SCEN-14 Closing Gap 4: groups AR invoices / AP bills / expenses / fixed
  // assets by their (previously write-only) costCenter tag.
  costCenter: (startDate?: string, endDate?: string) =>
    api.get<any>('/reports/cost-center', {
      ...(startDate && { startDate }),
      ...(endDate && { endDate }),
    }),
}

// ============ GL Reconciliation (Scenario 29 ACC-07) ============
export interface ArSubledgerReconciliation {
  asOfDate: string
  total: { subledger: number; gl: number; diff: number; matches: boolean }
  glBranchTaggingCoverage: number | null
  byBranch: {
    branchId: string | null
    branchName: string | null
    subledger: number
    gl: number
    diff: number
  }[]
}
export interface UnearnedInterestReconciliation {
  asOfDate: string
  subledgerRemaining: number
  glBalance: number
  diff: number
  matches: boolean
  scheduleWithMarkupCount: number
}
export interface EwalletClearingTrend {
  asOfDate: string
  periodDays: number
  periodStartDate: string
  currentBalance: number
  balanceAtPeriodStart: number
  delta: number
  trend: 'improving' | 'worsening' | 'flat'
  note: string
}
export const GlReconciliation = {
  arSubledger: (asOf?: string) =>
    api.get<ArSubledgerReconciliation>(
      '/reports/reconciliation/ar-subledger',
      asOf ? { asOf } : undefined
    ),
  unearnedInterest: (asOf?: string) =>
    api.get<UnearnedInterestReconciliation>(
      '/reports/reconciliation/unearned-interest',
      asOf ? { asOf } : undefined
    ),
  ewalletClearing: (days?: number) =>
    api.get<EwalletClearingTrend>(
      '/reports/reconciliation/ewallet-clearing',
      days ? { days } : undefined
    ),
}

// ============ AR Invoices ============

// Mirrors the backend's PaymentMethod enum (also used by JournalEntry).
export type PaymentMethod = 'CASH' | 'CARD' | 'CHECK' | 'BANK_TRANSFER' | 'QR'

export const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'CASH', label: 'Cash' },
  { value: 'CARD', label: 'Card' },
  { value: 'CHECK', label: 'Check' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'QR', label: 'QR' },
]

export type WithholdingCertificateStatus = 'pending' | 'received'
// Scenario 38 Gap 5 — "none" until a certificate is received; "flagged" when
// its stated amount doesn't match withholdingAmount (needs Accounting/CPA
// review); "resolved" once a reviewer has logged a decision. Never gates or
// adjusts the GL — see MarkCertificateReceivedDto's backend doc comment.
export type WithholdingVarianceStatus = 'none' | 'flagged' | 'resolved'

export interface ARPayment {
  id: string
  arInvoiceId: string
  amount: number
  withholdingAmount: number
  withholdingCertificateNo?: string | null
  withholdingCertificateStatus?: WithholdingCertificateStatus | null
  withholdingAtc?: string | null
  withholdingTaxableBase?: number | null
  withholdingTaxPeriod?: string | null
  withholdingCertificateDate?: string | null
  withholdingCertificateAmount?: number | null
  withholdingVarianceStatus?: WithholdingVarianceStatus | null
  withholdingVarianceNote?: string | null
  withholdingReviewerId?: string | null
  rebateAmount: number
  paymentDate: string
  method?: PaymentMethod | null
  reference?: string | null
  notes?: string | null
  isOverpayment: boolean
  overpaidAmount: number
  wasClosedAccount: boolean
  cancelledAt?: string | null
  cancelledById?: string | null
  cancelReason?: string | null
  branchId?: string | null
  collectorId?: string | null
  createdAt: string
}

// Scenario 38 Gap 5 — row shape for the Pending 2307 / CWT Variance lists,
// each ARPayment plus just enough of its parent invoice to identify it.
export interface WithholdingPaymentListItem extends ARPayment {
  arInvoice: { invoiceNumber: string; customer: { name: string } }
}

export interface MarkCertificateReceivedInput {
  certificateNo?: string
  certificateDate?: string
  certificateAmount: number
  atc?: string
  taxableBase?: number
  taxPeriod?: string
}

export interface ResolveWithholdingVarianceInput {
  notes?: string
}

export interface RecordArPaymentInput {
  amount: number
  paymentDate: string
  method?: PaymentMethod
  /** Same per-branch configured payment method POS checkout uses (POS Collections). */
  paymentMethodConfigId?: string
  /** Named sub-choice under paymentMethodConfigId, e.g. which bank/gateway. */
  paymentMethodOptionId?: string
  reference?: string
  notes?: string
  withholdingAmount?: number
  withholdingCertificateNo?: string
  withholdingCertificateStatus?: WithholdingCertificateStatus
  rebateAmount?: number
  bankAccountId?: string
  branchId?: string
  collectorId?: string
}

export interface ARInvoiceSerialGoodsReceipt {
  code: string
  receivedAt?: string
  supplier: { name: string } | null
  purchaseOrderNumber?: string | null
}

export interface ARInvoiceInstallmentItem {
  id: string
  itemId: string
  quantity: number | string
  unitPrice: number | string
  item: { id: string; name: string; brand: { name: string } | null } | null
  lineTotal: number
  serialNumber: {
    id: string
    serialNumber: string
    goodsReceiptLine?: { goodsReceipt: ARInvoiceSerialGoodsReceipt } | null
  } | null
  secondarySerialNumber: { id: string; serialNumber: string } | null
}

export interface ARInvoiceInstallmentDetail {
  termMonths: number | null
  rebate: number | string | null
  items: ARInvoiceInstallmentItem[]
  /** This due's position within the schedule (e.g. 2 of 12) — the rest of
   * this detail is schedule-wide and identical across every due-date
   * invoice on the same plan. */
  lineNumber: number | null
}

export interface ARInvoice {
  id: string
  invoiceNumber: string
  customerId: string
  customer?: { id: string; name: string }
  invoiceDate: string
  dueDate: string
  description?: string
  subtotal: number
  taxAmount: number
  totalAmount: number
  amountPaid: number
  status: string
  costCenter?: string
  payments?: ARPayment[]
  /** Scenario 25 — present only when this invoice is one due-date line of a
   * POS installment schedule; null for charge-mode invoices. */
  installmentDetail?: ARInvoiceInstallmentDetail | null
  posTransaction?: { id: string; transactionNumber: string; createdAt?: string } | null
}

export interface RecordPaymentResult extends ARInvoice {
  payment: ARPayment
  overpayment: { paymentId: string; overpaidAmount: number; wasClosedAccount: boolean } | null
}

// POS Collections bulk/early-payment ("Pay Selected") — settles several of a
// customer's own upcoming installment dues in one shot, with one shared
// (required) reference number across the whole batch.
export interface BulkPayInstallmentLineInput {
  invoiceId: string
  amount: number
  rebateAmount?: number
}

export interface BulkRecordArPaymentInput {
  lines: BulkPayInstallmentLineInput[]
  paymentDate: string
  method?: PaymentMethod
  paymentMethodConfigId?: string
  paymentMethodOptionId?: string
  /** Required only once collectorId is given — that's the only time an OR
   * is actually cut; optional for a walk-in payment with no collector. */
  reference?: string
  notes?: string
  branchId?: string
  collectorId?: string
}

export interface BulkRecordPaymentResult {
  payments: RecordPaymentResult[]
  totalCollected: number
  invoiceCount: number
}

export interface ARInvoiceCustomerResult {
  id: string
  name: string
  phone: string | null
  customerCode: string
}

export interface ARReceiptListItem {
  id: string
  arInvoiceId: string
  customerId: string
  customerName: string
  paymentDate: string
  reference: string | null
  receivedIn: string
  description: string | null
  accountLine: string
  invoiceNumber: string
  dueDate: string
  branchName: string | null
  amount: number
}

export const ARInvoices = {
  list: (params?: { search?: string; status?: string; customerId?: string; branchId?: string }) =>
    api.get<{ items: ARInvoice[]; total: number }>('/ar-invoices', params as any),
  // Scenario 44 — flat cross-customer Receipts register (one row per
  // ARPayment) backing the AR Invoices landing page, distinct from list()
  // above which returns ARInvoice rows for the customer-grouped rollup.
  listReceipts: (params?: { search?: string; customerId?: string; branchId?: string }) =>
    api.get<{ items: ARReceiptListItem[]; total: number }>('/ar-invoices/receipts', params as any),
  // Scoped to accounting:ar-invoices:read (not the CRM customer list, which
  // needs crm:customers:read — a permission Accountant doesn't hold) so
  // this screen's own customer picker works without any CRM grant.
  searchCustomers: (q: string) =>
    api.get<ARInvoiceCustomerResult[]>('/ar-invoices/customers/search', { q }),
  // Resolves one specific customer's name directly — used for the
  // "Filtered to X" banner when arriving via a customerId link (e.g. from
  // Customer360) and that customer has zero invoices, so there's nothing
  // in the loaded list to derive their name from otherwise.
  getCustomerById: (id: string) =>
    api.get<ARInvoiceCustomerResult[]>('/ar-invoices/customers/search', { id }),
  get: (id: string) => api.get<ARInvoice>(`/ar-invoices/${id}`),
  // Scenario 25 — print-ready envelope for the per-invoice detail page's
  // Print/Download action, same PrintDocumentEnvelope shape Purchase Orders
  // already use with printInventoryDocument().
  getDocument: (id: string) => api.get<unknown>(`/ar-invoices/${id}/document`),
  // Scenario 44 Part 2 — print-ready envelope for one Collection Receipt.
  getReceiptDocument: (invoiceId: string, paymentId: string) =>
    api.get<unknown>(`/ar-invoices/${invoiceId}/payments/${paymentId}/document`),
  create: (body: any) => api.post<ARInvoice>('/ar-invoices', body),
  update: (id: string, body: any) => api.patch<ARInvoice>(`/ar-invoices/${id}`, body),
  send: (id: string) => api.post<ARInvoice>(`/ar-invoices/${id}/send`, {}),
  recordPayment: (id: string, body: RecordArPaymentInput) =>
    api.post<RecordPaymentResult>(`/ar-invoices/${id}/payments`, body),
  recordBulkPayment: (body: BulkRecordArPaymentInput) =>
    api.post<BulkRecordPaymentResult>('/ar-invoices/bulk-payments', body),
  cancelPayment: (invoiceId: string, paymentId: string, reason?: string) =>
    api.post<ARInvoice>(`/ar-invoices/${invoiceId}/payments/${paymentId}/cancel`, { reason }),
  remove: (id: string) => api.delete(`/ar-invoices/${id}`),
  void: (id: string) => api.post<ARInvoice>(`/ar-invoices/${id}/void`, {}),
  // Scenario 26 Part 6 — manually-triggered sweep (no @Cron anywhere in the
  // backend), so a real "Check overdue" button is the only way to fire it
  // outside an external scheduler.
  sweepOverdueNotifications: () =>
    api.post<{ notified: number }>('/ar-invoices/sweep-overdue-notifications', {}),
  // Scenario 38 Gap 5 — CWT/2307 reconciliation.
  listPendingCertificates: () =>
    api.get<WithholdingPaymentListItem[]>('/ar-invoices/withholding/pending-certificates'),
  listFlaggedVariances: () =>
    api.get<WithholdingPaymentListItem[]>('/ar-invoices/withholding/variances'),
  markCertificateReceived: (
    invoiceId: string,
    paymentId: string,
    body: MarkCertificateReceivedInput
  ) => api.post<ARPayment>(`/ar-invoices/${invoiceId}/payments/${paymentId}/certificate`, body),
  resolveWithholdingVariance: (
    invoiceId: string,
    paymentId: string,
    body: ResolveWithholdingVarianceInput
  ) =>
    api.post<ARPayment>(
      `/ar-invoices/${invoiceId}/payments/${paymentId}/certificate/resolve-variance`,
      body
    ),
}

// ============ Credit Memos ============
export type CreditMemoStatus = 'ISSUED' | 'VOID'
export type CreditMemoType = 'sales_return' | 'billing_adjustment' | 'goodwill'
export interface CreditMemoLine {
  id: string
  itemId: string
  itemName?: string | null
  itemSku?: string | null
  quantity: number
  unitPrice: number
  serialNumberId?: string | null
  serialNumber?: { id: string; serialNumber: string } | null
  deductionAmount: number
}
export interface CreditMemo {
  id: string
  memoNumber: string
  customerId: string
  customer?: { id: string; name: string; customerCode?: string } | null
  arInvoiceId: string
  arInvoice?: {
    id: string
    invoiceNumber: string
    totalAmount: number
    amountPaid: number
    status: string
  } | null
  memoDate: string
  type: CreditMemoType
  amount: number
  lines: CreditMemoLine[]
  reason?: string | null
  status: CreditMemoStatus
  journalEntryId?: string | null
  /** Set when this memo was auto-created from an approved POS return/refund
   * (Scenario 13 Part 3) rather than issued by hand. */
  sourceReturnRequestId?: string | null
}
export interface CreateCreditMemoLineInput {
  itemId: string
  quantity: number
  unitPrice: number
  serialNumberId?: string
  deductionAmount?: number
}
export const CreditMemos = {
  list: (params?: {
    search?: string
    status?: string
    customerId?: string
    arInvoiceId?: string
  }) => api.get<{ items: CreditMemo[]; total: number }>('/credit-memos', params as any),
  get: (id: string) => api.get<CreditMemo>(`/credit-memos/${id}`),
  issue: (body: {
    arInvoiceId: string
    type: CreditMemoType
    lines: CreateCreditMemoLineInput[]
    reason?: string
    memoDate?: string
  }) => api.post<CreditMemo>('/credit-memos', body),
  void: (id: string) => api.post<CreditMemo>(`/credit-memos/${id}/void`, {}),
}

// ============ Debit Memos ============
export type DebitMemoStatus = 'ISSUED' | 'VOID'
export type DebitMemoType = 'unit_replacement' | 'billing_adjustment'
export interface DebitMemoLine {
  id: string
  itemId: string
  itemName?: string | null
  itemSku?: string | null
  quantity: number
  unitPrice: number
  serialNumberId?: string | null
  serialNumber?: { id: string; serialNumber: string } | null
  additionAmount: number
}
export interface DebitMemo {
  id: string
  memoNumber: string
  customerId: string
  customer?: { id: string; name: string; customerCode?: string } | null
  arInvoiceId: string
  arInvoice?: {
    id: string
    invoiceNumber: string
    totalAmount: number
    amountPaid: number
    status: string
  } | null
  memoDate: string
  type: DebitMemoType
  amount: number
  lines: DebitMemoLine[]
  reason?: string | null
  status: DebitMemoStatus
  journalEntryId?: string | null
}
export interface CreateDebitMemoLineInput {
  itemId: string
  quantity: number
  unitPrice: number
  serialNumberId?: string
  additionAmount?: number
}
export const DebitMemos = {
  list: (params?: {
    search?: string
    status?: string
    customerId?: string
    arInvoiceId?: string
  }) => api.get<{ items: DebitMemo[]; total: number }>('/debit-memos', params as any),
  get: (id: string) => api.get<DebitMemo>(`/debit-memos/${id}`),
  issue: (body: {
    arInvoiceId: string
    type: DebitMemoType
    lines: CreateDebitMemoLineInput[]
    reason?: string
    memoDate?: string
  }) => api.post<DebitMemo>('/debit-memos', body),
  void: (id: string) => api.post<DebitMemo>(`/debit-memos/${id}/void`, {}),
}

// ============ AP Bills ============
export interface APBillPayment {
  id: string
  amount: number
  withholdingAmount?: number
  paymentDate: string
  method?: string | null
  reference?: string | null
  notes?: string | null
  // Scenario 10 Part 5 — cheque number, present when method is "check".
  chequeNumber?: string | null
}
export interface APBill {
  id: string
  // Scenario 41 — the supplier's own invoice number, as printed on their
  // invoice. Never generated by this system. Null on a DRAFT bill
  // auto-generated straight off a goods receipt, before anyone's typed in
  // the real invoice number yet — required before it can be received.
  billNumber: string | null
  // Scenario 33 collapsed the old separate vendorId (required) + supplierId
  // (optional) pair into this single required field.
  supplierId: string
  supplier?: {
    id: string
    code: string
    name: string
    // Scenario 43 Part B — fallback account for the printed/on-screen
    // Account breakdown table when the bill has no override of its own.
    defaultExpenseAccount?: { id: string; name: string } | null
  } | null
  // Scenario 43 Part B — override expense account for this bill; falls
  // back to supplier.defaultExpenseAccount, then (print-only, resolved
  // server-side in getDocument()) the tenant's DEFAULT_EXPENSE mapping.
  expenseAccountId?: string | null
  expenseAccount?: { id: string; name: string } | null
  // Scenario 10 Part 2 — the PO this invoice bills against, and the RRs
  // matched to it, for the 3-way match.
  purchaseOrderId?: string | null
  purchaseOrder?: {
    id: string
    code: string
    status:
      | 'draft'
      | 'approved'
      | 'sent'
      | 'partially_received'
      | 'fully_received'
      | 'closed'
      | 'cancelled'
  } | null
  goodsReceipts?: {
    id: string
    code: string
    receivedAt?: string
    purchaseOrderNumber?: string | null
    deliveryReceiptNumber?: string | null
    supplierInvoiceNumber?: string | null
    // Line-level detail — only populated by APBills.get() (the detail
    // page), findAll()'s list view stays on the lighter shape above.
    lines?: {
      id: string
      quantityReceived: number
      unitCost?: number | null
      isFreebie?: boolean
      item?: { id: string; name: string; sku?: string } | null
    }[]
  }[]
  // Scenario 10 Part 4 — voucher + two-step approval status. Scenario 43 —
  // voucherNumber is system-generated (never typed in); 'voided' means a
  // still-pending voucher was retracted before approval — its number stays
  // on the row permanently (retired, not reissued) rather than clearing.
  voucherNumber?: string | null
  voucherApprovalStatus?:
    | 'pending_online_approval'
    | 'pending_onsite_approval'
    | 'approved'
    | 'rejected'
    | 'voided'
    | null
  voucherRejectedReason?: string | null
  billDate: string
  dueDate: string
  description?: string
  subtotal: number
  // Input tax (VAT) on this purchase.
  taxAmount: number
  // Withholding tax withheld from the supplier — defaults to the
  // supplier's configured withholding rate × subtotal (editable override).
  // Posted to WHT Payable and counted toward amountPaid when the bill is
  // received, not at payment time.
  withholdingAmount?: number
  totalAmount: number
  amountPaid: number
  status: string
  costCenter?: string
  // How this bill will be paid — captured on the bill (while still DRAFT)
  // instead of at Record Payment. Feeds APPaymentMethodConfig resolution.
  sourceOfPayment?: string | null
  // Payment/transfer reference — captured on the bill instead of at Record
  // Payment.
  referenceNumber?: string | null
  // Cheque/payment-instrument serial number — captured on the bill instead
  // of at Record Payment (was APPaymentPayment.chequeNumber's input).
  serialNumber?: string | null
  payments?: APBillPayment[]
  // True when scaffolded automatically from a goods receipt rather than
  // typed in by hand — see ap-bills.service.ts's createOrAttachDraftFromReceipt.
  isAutoGenerated?: boolean
}
// Scenario 43 Part D — one row of the standalone Payments list, across all
// bills (GET /ap-bills/payments). Read-only, no create/edit type needed.
export interface APPaymentListItem {
  id: string
  billId: string
  paymentDate: string
  reference: string | null
  bankAccount: { id: string; name: string } | null
  description: string | null
  payee: string | null
  billNumber: string | null
  voucherNumber: string | null
  effectiveExpenseAccount: { id: string; name: string } | null
  amount: number
}
export const APBills = {
  list: (params?: { search?: string; status?: string; supplierId?: string }) =>
    api.get<{ items: APBill[]; total: number }>('/ap-bills', params as any),
  get: (id: string) => api.get<APBill>(`/ap-bills/${id}`),
  getDocument: (id: string) => api.get<unknown>(`/ap-bills/${id}/document`),
  create: (body: any) => api.post<APBill>('/ap-bills', body),
  update: (id: string, body: any) => api.patch<APBill>(`/ap-bills/${id}`, body),
  receive: (id: string) => api.post<APBill>(`/ap-bills/${id}/receive`, {}),
  recordPayment: (id: string, body: any) => api.post<APBill>(`/ap-bills/${id}/payments`, body),
  remove: (id: string) => api.delete(`/ap-bills/${id}`),
  // Scenario 10 Part 4 — voucher creation + two-step approval.
  // Scenario 43 — voucherNumber is system-generated, no longer sent by the
  // caller; voidVoucher resets a still-pending voucher back to unraised.
  createVoucher: (id: string) => api.post<APBill>(`/ap-bills/${id}/voucher`, {}),
  voidVoucher: (id: string) => api.post<APBill>(`/ap-bills/${id}/voucher/void`, {}),
  approveVoucherOnline: (id: string) =>
    api.post<APBill>(`/ap-bills/${id}/voucher/approve-online`, {}),
  approveVoucherOnsite: (id: string) =>
    api.post<APBill>(`/ap-bills/${id}/voucher/approve-onsite`, {}),
  rejectVoucher: (id: string, reason: string) =>
    api.post<APBill>(`/ap-bills/${id}/voucher/reject`, { reason }),
  // Scenario 43 Part D — standalone Payments list across all bills.
  listPayments: (params?: { search?: string; supplierId?: string }) =>
    api.get<{ items: APPaymentListItem[]; total: number }>('/ap-bills/payments', params as any),
}

// ============ File Attachments (shared — used by AP voucher, Scenario 10 Part 4) ============
export interface FileAttachment {
  id: string
  fileId: string
  entityType: string
  entityId: string
  attachedAt: string
  file: {
    id: string
    originalName: string
    mimeType: string
    size: number
  }
}
export const FileAttachments = {
  listForEntity: (entityType: string, entityId: string) =>
    api.get<FileAttachment[]>('/file-attachments', { entityType, entityId }),
  attach: (fileId: string, entityType: string, entityId: string) =>
    api.post<FileAttachment>('/file-attachments', { fileId, entityType, entityId }),
  detach: (id: string) => api.delete(`/file-attachments/${id}`),
}

// ============ AP Bill Suppliers (Scenario 10 Part 1) ============
export interface APBillSupplierOption {
  id: string
  code: string
  name: string
}
export const APBillSuppliers = {
  list: () =>
    api.get<{ data: APBillSupplierOption[]; total: number }>('/suppliers', {
      status: 'active',
      limit: 200,
    }),
}

// ============ AP Bill 3-way match — PO/RR picker + match-check (Scenario 10 Part 2) ============
export interface APBillPurchaseOrderOption {
  id: string
  code: string
  status: string
  totalAmount: number
}
export interface APBillGoodsReceiptOption {
  id: string
  code: string
  receivedAt: string
}
export interface APBillMatchCheck {
  applicable: boolean
  poTotal: number | null
  rrTotal: number | null
  invoiceTotal: number
  matched: boolean
  varianceFromPo: number | null
  varianceFromRr: number | null
  goodsReceiptCount?: number
}
export const APBillMatching = {
  purchaseOrders: (supplierId: string) =>
    api.get<{ data: APBillPurchaseOrderOption[]; total: number }>('/procurement/purchase-orders', {
      supplierId,
      limit: 100,
    }),
  receipts: (poId: string) =>
    api.get<{ data: APBillGoodsReceiptOption[] }>(`/procurement/purchase-orders/${poId}/receipts`),
  matchCheck: (billId: string) => api.get<APBillMatchCheck>(`/ap-bills/${billId}/match-check`),
}

// ============ Supplier Debit Memos — supplier returns (Scenario 10 Part 5) ============
export interface SupplierDebitMemo {
  id: string
  memoNumber: string
  apBillId: string
  supplierId: string
  itemId: string
  warehouseId: string
  quantity: number
  amount: number
  reason?: string | null
  memoDate: string
  status: 'ISSUED' | 'VOID'
}
export const SupplierDebitMemos = {
  list: (params?: { search?: string; status?: string; supplierId?: string; apBillId?: string }) =>
    api.get<{ items: SupplierDebitMemo[]; total: number }>('/supplier-debit-memos', params as any),
  get: (id: string) => api.get<SupplierDebitMemo>(`/supplier-debit-memos/${id}`),
  issue: (body: {
    apBillId: string
    itemId: string
    warehouseId: string
    quantity: number
    amount: number
    reason?: string
    memoDate?: string
  }) => api.post<SupplierDebitMemo>('/supplier-debit-memos', body),
  void: (id: string) => api.post<SupplierDebitMemo>(`/supplier-debit-memos/${id}/void`, {}),
}

// ============ AP Payment Methods — supplier payment method + GL config (Scenario 10 Part 3) ============
export interface APPaymentMethodConfig {
  id: string
  key?: string | null
  name: string
  label: string
  isEnabled: boolean
  displayOrder: number
  glAccountId?: string | null
}
export const APPaymentMethods = {
  list: () => api.get<APPaymentMethodConfig[]>('/ap-payment-methods'),
  create: (body: { name: string; label: string; glAccountId?: string }) =>
    api.post<APPaymentMethodConfig>('/ap-payment-methods', body),
  update: (id: string, body: { name?: string; label?: string; glAccountId?: string }) =>
    api.patch<APPaymentMethodConfig>(`/ap-payment-methods/${id}`, body),
  remove: (id: string) => api.delete(`/ap-payment-methods/${id}`),
}

// ============ Business Expenses ============
export type BusinessExpenseStatus = 'DRAFT' | 'RECORDED' | 'VOID'
// Scenario 40 Gap 1 + Part 2 — Payee is now typed; OTHER unlocks the
// Special Account list, including CA_LIQUIDATION (Part 2's settlement flow).
export type PayeeType = 'CUSTOMER' | 'SUPPLIER' | 'OTHER'
export type SpecialAccountType =
  | 'EMPLOYEE_CASH_ADVANCE'
  | 'EMPLOYEE_CASH_LOAN'
  | 'CASH_LOAN_OTHERS'
  | 'CA_LIQUIDATION'
// The three types a liquidation can actually close out.
export type LiquidatableType = 'EMPLOYEE_CASH_ADVANCE' | 'EMPLOYEE_CASH_LOAN' | 'CASH_LOAN_OTHERS'
// Scenario 40 Part 6 — one entry is now a header + N lines. Which
// dimension is fixed at the header vs. varies per line depends on
// payeeType: CUSTOMER/SUPPLIER fixes the payee and lets each line pick its
// own category; OTHER fixes the Special Account category and lets each
// line pick its own recipient.
export interface BusinessExpenseLine {
  id: string
  lineNumber: number
  categoryAccountId: string
  categoryAccount?: { id: string; name: string; number?: string } | null
  employeeId?: string | null
  employee?: { id: string; firstName: string; lastName: string; employeeCode: string } | null
  payee?: string | null
  description?: string | null
  amount: number
  taxCode?: string | null
  taxAmount: number
}
export interface BusinessExpense {
  id: string
  expenseNumber: string
  expenseDate: string
  payeeType?: PayeeType | null
  supplierId?: string | null
  supplier?: { id: string; name: string } | null
  customerId?: string | null
  customer?: { id: string; name: string } | null
  specialAccountType?: SpecialAccountType | null
  liquidatesType?: LiquidatableType | null
  payee?: string | null
  description?: string | null
  lines: BusinessExpenseLine[]
  subtotal: number
  taxAmount: number
  totalAmount: number
  paymentMethod?: string | null
  bankAccountId?: string | null
  reference?: string | null
  costCenter?: string | null
  status: BusinessExpenseStatus
  journalEntryId?: string | null
}
export const Expenses = {
  list: (params?: {
    search?: string
    status?: string
    categoryAccountId?: string
    supplierId?: string
    startDate?: string
    endDate?: string
  }) => api.get<{ items: BusinessExpense[]; total: number }>('/expenses', params as any),
  get: (id: string) => api.get<BusinessExpense>(`/expenses/${id}`),
  create: (body: any) => api.post<BusinessExpense>('/expenses', body),
  update: (id: string, body: any) => api.patch<BusinessExpense>(`/expenses/${id}`, body),
  record: (id: string) => api.post<BusinessExpense>(`/expenses/${id}/record`, {}),
  void: (id: string) => api.post<BusinessExpense>(`/expenses/${id}/void`, {}),
  remove: (id: string) => api.delete(`/expenses/${id}`),
  // Scenario 40 Part 2 — outstanding balance for a person/party on a
  // Special Account type, shown before a CA-Liquidation amount is entered.
  getSpecialAccountBalance: (params: {
    specialAccountType: LiquidatableType
    employeeId?: string
    payee?: string
  }) => api.get<{ outstanding: number }>('/expenses/special-account-balance', params as any),
}

// ─── Employees (search-pick a Special Account expense payee) ──
export interface EmployeeLite {
  id: string
  employeeCode: string
  firstName: string
  lastName: string
  middleName?: string | null
  branch?: { id: string; name: string } | null
}
export const EmployeesApi = {
  search: (search?: string) =>
    api.get<EmployeeLite[]>('/accounting/employees', search ? { search } : undefined),
}

// ============ Bank Accounts ============
export interface BankAccount {
  id: string
  name: string
  bankName: string
  accountNumber: string
  accountType: string
  currencyCode: string
  currentBalance: number
  isActive: boolean
  /** GL account this bank/fund posts to instead of the shared Default Cash/Bank mapping. */
  glAccountId?: string | null
}
// Scenario 42 — the itemized worksheet. sourceType/direction mirror the
// backend's BankReconciliationLineSourceType/Direction enums.
export type BankReconciliationLineSourceType = 'AR_PAYMENT' | 'AP_PAYMENT' | 'CLEARING_SETTLEMENT'
export type BankReconciliationLineDirection = 'DEPOSIT' | 'WITHDRAWAL'
export interface BankReconciliationLine {
  id: string
  bankReconciliationId: string
  sourceType: BankReconciliationLineSourceType
  sourceId: string
  direction: BankReconciliationLineDirection
  amount: number
  date: string
  reference?: string | null
  checked: boolean
}
export interface BankReconciliation {
  id: string
  bankAccountId: string
  bankAccount?: BankAccount
  statementDate: string
  statementBalance: number
  systemBalance: number
  /** Persisted at Complete time only — null until then. */
  discrepancy?: number | null
  reconciled: boolean
  notes?: string | null
  reconciledAt?: string | null
  lines: BankReconciliationLine[]
  /** Only present on the single-worksheet GET — not the list endpoint. */
  pendingDeposits?: BankReconciliationLine[]
  pendingWithdrawals?: BankReconciliationLine[]
}
export const BankAccounts = {
  list: () => api.get<BankAccount[]>('/bank-accounts'),
  get: (id: string) => api.get<BankAccount>(`/bank-accounts/${id}`),
  create: (body: any) => api.post<BankAccount>('/bank-accounts', body),
  update: (id: string, body: any) => api.patch<BankAccount>(`/bank-accounts/${id}`, body),
  remove: (id: string) => api.delete(`/bank-accounts/${id}`),
  listReconciliations: (bankAccountId?: string) =>
    api.get<BankReconciliation[]>(
      '/bank-accounts/reconciliations',
      bankAccountId ? { bankAccountId } : undefined
    ),
  createReconciliation: (body: {
    bankAccountId: string
    statementDate: string
    statementBalance: number
    notes?: string
  }) => api.post<BankReconciliation>('/bank-accounts/reconciliations', body),
  getReconciliationWorksheet: (id: string) =>
    api.get<BankReconciliation>(`/bank-accounts/reconciliations/${id}`),
  toggleReconciliationLine: (id: string, lineId: string, checked: boolean) =>
    api.patch<BankReconciliationLine>(`/bank-accounts/reconciliations/${id}/lines/${lineId}`, {
      checked,
    }),
  completeReconciliation: (id: string) =>
    api.post<any>(`/bank-accounts/reconciliations/${id}/complete`, {}),
}

// ============ Fixed Assets ============
export interface FixedAsset {
  id: string
  assetCode: string
  name: string
  category?: string
  acquisitionDate: string
  acquisitionCost: number
  salvageValue: number
  usefulLifeMonths: number
  depreciationMethod: string
  accumulatedDepreciation: number
  bookValue: number
  status: string
  costCenter?: string
}
export const FixedAssets = {
  list: () => api.get<FixedAsset[]>('/fixed-assets'),
  get: (id: string) => api.get<FixedAsset>(`/fixed-assets/${id}`),
  create: (body: any) => api.post<FixedAsset>('/fixed-assets', body),
  update: (id: string, body: any) => api.patch<FixedAsset>(`/fixed-assets/${id}`, body),
  remove: (id: string) => api.delete(`/fixed-assets/${id}`),
  runDepreciation: () => api.post<any>('/fixed-assets/run-depreciation', {}),
}

// ============ Recurring Entries ============
export interface RecurringEntry {
  id: string
  name: string
  description?: string
  frequency: string
  startDate: string
  endDate?: string
  nextRunDate: string
  template: any
  isActive: boolean
  lastRunAt?: string
}
export const RecurringEntries = {
  list: () => api.get<RecurringEntry[]>('/recurring-entries'),
  get: (id: string) => api.get<RecurringEntry>(`/recurring-entries/${id}`),
  create: (body: any) => api.post<RecurringEntry>('/recurring-entries', body),
  update: (id: string, body: any) => api.patch<RecurringEntry>(`/recurring-entries/${id}`, body),
  remove: (id: string) => api.delete(`/recurring-entries/${id}`),
  runNow: (id: string) => api.post<any>(`/recurring-entries/${id}/run`, {}),
}

// ============ Fiscal Periods (ACC-25 period close) ============
export type FiscalPeriodStatus = 'OPEN' | 'SOFT_CLOSED' | 'HARD_CLOSED'
export type ChecklistKey =
  | 'bankReconciliation'
  | 'arAgingReview'
  | 'apAgingReview'
  | 'fixedAssetDepreciation'
  | 'accruals'
  | 'taxAccruals'

export interface ChecklistItem {
  done: boolean
  completedAt?: string | null
  completedBy?: string | null
}
export type Checklist = Partial<Record<ChecklistKey, ChecklistItem>>

export interface FiscalPeriod {
  id: string
  name: string
  startDate: string
  endDate: string
  status?: FiscalPeriodStatus
  softClosedAt?: string | null
  softClosedBy?: string | null
  isLocked: boolean
  lockedAt?: string | null
  lockedBy?: string | null
  closeChecklist?: Checklist | null
  notes?: string | null
}

export interface PeriodReopenLog {
  id: string
  fiscalPeriodId: string
  reopenedAt: string
  reopenedBy: string
  reason: string
  previousStatus: FiscalPeriodStatus
}

export interface ChecklistStatus {
  checklist: Checklist
  completed: number
  total: number
  complete: boolean
}

export const CHECKLIST_LABELS: Record<ChecklistKey, string> = {
  bankReconciliation: 'Bank reconciliation',
  arAgingReview: 'AR aging review',
  apAgingReview: 'AP aging review',
  fixedAssetDepreciation: 'Fixed asset depreciation',
  accruals: 'Accruals',
  taxAccruals: 'Tax accruals',
}

export const FiscalPeriods = {
  list: () => api.get<FiscalPeriod[]>('/fiscal-periods'),
  create: (body: any) => api.post<FiscalPeriod>('/fiscal-periods', body),
  softClose: (id: string) => api.post<FiscalPeriod>(`/fiscal-periods/${id}/soft-close`, {}),
  hardClose: (id: string) => api.post<FiscalPeriod>(`/fiscal-periods/${id}/hard-close`, {}),
  reopen: (id: string, reason: string) =>
    api.post<FiscalPeriod>(`/fiscal-periods/${id}/reopen`, { reason }),
  getReopenLogs: (id: string) => api.get<PeriodReopenLog[]>(`/fiscal-periods/${id}/reopen-logs`),
  getChecklist: (id: string) => api.get<ChecklistStatus>(`/fiscal-periods/${id}/checklist`),
  setChecklistItem: (id: string, key: ChecklistKey, done: boolean) =>
    api.patch<FiscalPeriod>(`/fiscal-periods/${id}/checklist/${key}`, { done }),
  // Legacy
  lock: (id: string) => api.post<FiscalPeriod>(`/fiscal-periods/${id}/hard-close`, {}),
  unlock: (id: string) => api.post<FiscalPeriod>(`/fiscal-periods/${id}/unlock`, {}),
  remove: (id: string) => api.delete(`/fiscal-periods/${id}`),
}

// ============ Tax ============
// ============ Account Mapping ============
export interface AccountMapping {
  key: string
  label: string
  description?: string
  accountId?: string | null
}
export const AccountMappings = {
  list: () => api.get<AccountMapping[]>('/account-mapping'),
  setOne: (key: string, accountId: string | null) =>
    api.patch<AccountMapping>(`/account-mapping/${key}`, { accountId }),
  setBulk: (mappings: { key: string; accountId: string | null }[]) =>
    api.post<AccountMapping[]>('/account-mapping/bulk', { mappings }),
}

// ============ COA Seed ============
export const COASeed = {
  seedPH: () =>
    api.post<{ created: number; skipped: number; total: number; mappingsConfigured: number }>(
      '/coa-seed/ph',
      {}
    ),
}

// ============ Bank Adjusting ============
export const BankAdjusting = {
  create: (body: {
    bankAccountId: string
    type: 'BANK_CHARGE' | 'INTEREST_INCOME'
    amount: number
    date: string
    description?: string
  }) => api.post<any>('/bank-accounts/adjusting-entry', body),
}

// Scenario 40 Gap 5 — inter-account transfer (e.g. funding a Petty Cash
// Fund / the Revolving Fund from the main operating account).
export const BankTransfers = {
  create: (body: {
    sourceBankAccountId: string
    destinationBankAccountId: string
    amount: number
    date: string
    reference?: string
    description?: string
  }) => api.post<any>('/bank-accounts/transfer', body),
}

// ============ Clearing Settlements & Unidentified Bank Credits (Scenario 38 Gap 1) ============
export type ClearingSettlementType = 'card' | 'ewallet' | 'bank_transfer' | 'tpf'

export interface ClearingSettlement {
  id: string
  clearingType: ClearingSettlementType
  tpfProviderId?: string | null
  tpfProvider?: { id: string; name: string } | null
  bankAccountId: string
  bankAccount?: BankAccount
  amount: number
  feeAmount: number
  referenceNo?: string | null
  settledAt: string
  journalEntryId?: string | null
  createdAt: string
}

export interface UnidentifiedBankCredit {
  id: string
  bankAccountId: string
  bankAccount?: BankAccount
  amount: number
  creditDate: string
  bankRef?: string | null
  status: 'unmatched' | 'reclassified'
  reclassifiedNote?: string | null
  reclassifiedAt?: string | null
  journalEntryId?: string | null
  reclassJournalEntryId?: string | null
  createdAt: string
}

export const ClearingSettlements = {
  list: (filters?: { clearingType?: ClearingSettlementType; tpfProviderId?: string }) =>
    api.get<ClearingSettlement[]>('/bank-accounts/clearing-settlements', filters as any),
  record: (body: {
    bankAccountId: string
    clearingType: ClearingSettlementType
    tpfProviderId?: string
    amount: number
    feeAmount?: number
    referenceNo?: string
    settledAt: string
  }) => api.post<ClearingSettlement>('/bank-accounts/clearing-settlements', body),
  activeTpfProviders: () => api.get<{ id: string; name: string }[]>('/bank-accounts/tpf-providers'),
}

// ============ Unapplied Customer Collections (Scenario 38 Gap 4) ============
export type UnappliedCollectionStatus = 'UNMATCHED' | 'APPLIED' | 'REFUNDED'

export interface UnappliedCustomerCollection {
  id: string
  customerId: string
  customer?: { id: string; name: string; customerCode?: string | null }
  branchId: string
  branch?: { id: string; name: string; code?: string | null }
  amount: number
  unappliedAmount: number
  paymentMethod?: string | null
  reference?: string | null
  notes?: string | null
  status: UnappliedCollectionStatus
  journalEntryId?: string | null
  createdAt: string
}

export const UnappliedCollections = {
  list: (filters?: {
    status?: UnappliedCollectionStatus
    customerId?: string
    branchId?: string
  }) => api.get<UnappliedCustomerCollection[]>('/accounting/unapplied-collections', filters as any),
  get: (id: string) =>
    api.get<UnappliedCustomerCollection>(`/accounting/unapplied-collections/${id}`),
  record: (body: {
    customerId: string
    amount: number
    paymentMethod?: string
    reference?: string
    notes?: string
    branchId?: string
  }) => api.post<UnappliedCustomerCollection>('/accounting/unapplied-collections', body),
  apply: (id: string, body: { arInvoiceId: string; amount?: number; paymentDate?: string }) =>
    api.post<UnappliedCustomerCollection>(`/accounting/unapplied-collections/${id}/apply`, body),
  refund: (id: string, body: { amount?: number; reason?: string }) =>
    api.post<UnappliedCustomerCollection>(`/accounting/unapplied-collections/${id}/refund`, body),
}

export const UnidentifiedBankCredits = {
  list: (status?: 'unmatched' | 'reclassified') =>
    api.get<UnidentifiedBankCredit[]>(
      '/bank-accounts/unidentified-bank-credits',
      status ? { status } : undefined
    ),
  record: (body: { bankAccountId: string; amount: number; creditDate: string; bankRef?: string }) =>
    api.post<UnidentifiedBankCredit>('/bank-accounts/unidentified-bank-credits', body),
  reclassify: (id: string, body: { targetType: ClearingSettlementType; tpfProviderId?: string }) =>
    api.post<UnidentifiedBankCredit>(
      `/bank-accounts/unidentified-bank-credits/${id}/reclassify`,
      body
    ),
}

// ============ Employee Appliance Loans (Scenario 40 Part 4) ============
export type EmployeeApplianceLoanStatus = 'ACTIVE' | 'PAID_OFF' | 'CANCELLED'
export interface EmployeeApplianceLoanPaymentRow {
  id: string
  amount: number
  paymentDate: string
  note?: string | null
  journalEntryId?: string | null
}
export interface EmployeeApplianceLoan {
  id: string
  loanNumber: string
  employeeId: string
  employee?: { id: string; firstName: string; lastName: string; employeeCode: string } | null
  itemDescription: string
  listedCashPrice: number
  downPayment: number
  amountFinanced: number
  termMonths: number
  miFactor: number
  monthlyInstallment: number
  pnv: number
  totalPrice: number
  interestDifferential: number
  ppd: number
  openingBalance: number
  currentBalance: number
  status: EmployeeApplianceLoanStatus
  startDate: string
  nextDueDate?: string | null
  journalEntryId?: string | null
  payments?: EmployeeApplianceLoanPaymentRow[]
}
export const EmployeeApplianceLoans = {
  list: (params?: { search?: string; status?: string; employeeId?: string }) =>
    api.get<{ items: EmployeeApplianceLoan[]; total: number }>(
      '/employee-appliance-loans',
      params as any
    ),
  get: (id: string) => api.get<EmployeeApplianceLoan>(`/employee-appliance-loans/${id}`),
  create: (body: {
    employeeId: string
    itemDescription: string
    listedCashPrice: number
    downPayment: number
    termMonths: number
    miFactor: number
    startDate?: string
  }) => api.post<EmployeeApplianceLoan>('/employee-appliance-loans', body),
  recordPayment: (id: string, body: { amount: number; paymentDate: string; note?: string }) =>
    api.post<EmployeeApplianceLoanPaymentRow>(`/employee-appliance-loans/${id}/payments`, body),
}

// ============ Helpers ============
export function fmtMoney(n: number | string | undefined | null): string {
  if (n === null || n === undefined || n === '') return '—'
  const v = typeof n === 'string' ? Number(n) : n
  if (Number.isNaN(v)) return String(n)
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(v)
}
export function fmtDate(d: string | Date | undefined | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
