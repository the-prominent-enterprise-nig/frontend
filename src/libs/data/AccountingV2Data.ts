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

// ============ FX Revaluation (ACC-26) ============
export interface FxRate {
  id: string
  currencyId: string
  currency?: { id: string; code: string; name: string }
  rate: number
  effectiveDate: string
  source?: string | null
}
export interface RevaluationLine {
  id: string
  runId: string
  accountId: string
  account?: { id: string; number?: string; name: string }
  currencyId: string
  currency?: { id: string; code: string }
  beforeBalance: number
  rateUsed: number
  afterBalance: number
  gainLoss: number
}
export interface RevaluationRun {
  id: string
  asOfDate: string
  periodId?: string | null
  journalEntryId?: string | null
  reversalJEId?: string | null
  totalGainLoss: number
  status: 'DRAFT' | 'POSTED' | 'REVERSED'
  notes?: string | null
  createdBy?: string | null
  createdAt: string
  lines: RevaluationLine[]
}
export const FxRevaluation = {
  listRates: (currencyId?: string) =>
    api.get<FxRate[]>('/fx-revaluation/rates', currencyId ? { currencyId } : undefined),
  addRate: (body: { currencyId: string; rate: number; effectiveDate: string; source?: string }) =>
    api.post<FxRate>('/fx-revaluation/rates', body),
  listRuns: () => api.get<RevaluationRun[]>('/fx-revaluation/runs'),
  preview: (asOfDate: string) =>
    api.get<{
      asOfDate: string
      totalGainLoss: number
      lines: Omit<RevaluationLine, 'id' | 'runId'>[]
    }>('/fx-revaluation/preview', { asOfDate }),
  createRun: (body: { asOfDate: string; periodId?: string; notes?: string }) =>
    api.post<RevaluationRun>('/fx-revaluation/runs', body),
}

// ============ Tax Rates (ACC-21) ============
export type TaxRateType = 'VAT' | 'EXEMPT' | 'ZERO_RATED' | 'WHT'
export interface TaxRate {
  id: string
  code: string
  name: string
  ratePercent: number | string
  type: TaxRateType
  description?: string | null
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}
export const TaxRates = {
  list: (activeOnly?: boolean) =>
    api.get<TaxRate[]>('/tax-rates', activeOnly ? { activeOnly: 'true' } : undefined, {
      tags: ['tax-rates'],
    }),
  get: (id: string) => api.get<TaxRate>(`/tax-rates/${id}`),
  create: (body: Omit<TaxRate, 'id' | 'createdAt' | 'updatedAt'>) =>
    api.post<TaxRate>('/tax-rates', body),
  update: (id: string, body: Partial<TaxRate>) => api.patch<TaxRate>(`/tax-rates/${id}`, body),
  remove: (id: string) => api.delete(`/tax-rates/${id}`),
}

// ============ Reports ============
export const Reports = {
  trialBalance: (asOf?: string) =>
    api.get<any>('/reports/trial-balance', asOf ? { asOf } : undefined),
  pnl: (startDate: string, endDate: string) =>
    api.get<any>('/reports/profit-and-loss', { startDate, endDate }),
  balanceSheet: (asOf?: string) =>
    api.get<any>('/reports/balance-sheet', asOf ? { asOf } : undefined),
  generalLedger: (params: { accountId?: string; startDate?: string; endDate?: string }) =>
    api.get<any>('/reports/general-ledger', params as any),
  cashFlow: (startDate: string, endDate: string) =>
    api.get<any>('/reports/cash-flow', { startDate, endDate }),
  aging: (type: 'ar' | 'ap', asOf?: string) =>
    api.get<any>(`/reports/aging/${type}`, asOf ? { asOf } : undefined),
  customerStatement: (id: string) => api.get<any>(`/reports/customer-statement/${id}`),
  supplierStatement: (id: string) => api.get<any>(`/reports/supplier-statement/${id}`),
  biSummary: () => api.get<any>('/reports/bi-summary'),
}

// ============ AR Invoices ============
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
  payments?: any[]
}
export const ARInvoices = {
  list: (params?: { search?: string; status?: string; customerId?: string }) =>
    api.get<{ items: ARInvoice[]; total: number }>('/ar-invoices', params as any),
  get: (id: string) => api.get<ARInvoice>(`/ar-invoices/${id}`),
  create: (body: any) => api.post<ARInvoice>('/ar-invoices', body),
  update: (id: string, body: any) => api.patch<ARInvoice>(`/ar-invoices/${id}`, body),
  send: (id: string) => api.post<ARInvoice>(`/ar-invoices/${id}/send`, {}),
  recordPayment: (id: string, body: any) =>
    api.post<ARInvoice>(`/ar-invoices/${id}/payments`, body),
  remove: (id: string) => api.delete(`/ar-invoices/${id}`),
}

// ============ AP Bills ============
export interface APBill {
  id: string
  billNumber: string
  vendorId: string
  vendor?: { id: string; name: string }
  billDate: string
  dueDate: string
  description?: string
  subtotal: number
  taxAmount: number
  totalAmount: number
  amountPaid: number
  status: string
  costCenter?: string
  payments?: any[]
}
export const APBills = {
  list: (params?: { search?: string; status?: string; vendorId?: string }) =>
    api.get<{ items: APBill[]; total: number }>('/ap-bills', params as any),
  get: (id: string) => api.get<APBill>(`/ap-bills/${id}`),
  create: (body: any) => api.post<APBill>('/ap-bills', body),
  update: (id: string, body: any) => api.patch<APBill>(`/ap-bills/${id}`, body),
  receive: (id: string) => api.post<APBill>(`/ap-bills/${id}/receive`, {}),
  recordPayment: (id: string, body: any) => api.post<APBill>(`/ap-bills/${id}/payments`, body),
  remove: (id: string) => api.delete(`/ap-bills/${id}`),
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
}
export const BankAccounts = {
  list: () => api.get<BankAccount[]>('/bank-accounts'),
  get: (id: string) => api.get<BankAccount>(`/bank-accounts/${id}`),
  create: (body: any) => api.post<BankAccount>('/bank-accounts', body),
  update: (id: string, body: any) => api.patch<BankAccount>(`/bank-accounts/${id}`, body),
  remove: (id: string) => api.delete(`/bank-accounts/${id}`),
  listReconciliations: (bankAccountId?: string) =>
    api.get<any[]>('/bank-accounts/reconciliations', bankAccountId ? { bankAccountId } : undefined),
  createReconciliation: (body: any) => api.post<any>('/bank-accounts/reconciliations', body),
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
export const Tax = {
  listConfigs: () => api.get<any[]>('/tax/configurations'),
  createConfig: (body: any) => api.post<any>('/tax/configurations', body),
  updateConfig: (id: string, body: any) => api.patch<any>(`/tax/configurations/${id}`, body),
  removeConfig: (id: string) => api.delete(`/tax/configurations/${id}`),
  calculate: (amount: number, rate: number) => api.post<any>('/tax/calculate', { amount, rate }),
  filingSummary: (startDate: string, endDate: string) =>
    api.get<any>('/tax/filing-summary', { startDate, endDate }),
}

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
