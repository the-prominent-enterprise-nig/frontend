import { z } from 'zod'

export const LeadStatusEnum = z.enum(['active', 'won', 'lost', 'archived'])
export type LeadStatus = z.infer<typeof LeadStatusEnum>

export const CustomerSourceChannelEnum = z.enum(['pos_walkin', 'sales', 'crm_lead', 'online'])
export type CustomerSourceChannel = z.infer<typeof CustomerSourceChannelEnum>

export const CustomerStatusEnum = z.enum(['active', 'inactive', 'blocked'])
export type CustomerStatus = z.infer<typeof CustomerStatusEnum>

export const CustomerTypeEnum = z.enum(['individual', 'business', 'employee'])
export type CustomerType = z.infer<typeof CustomerTypeEnum>

export const CustomerLifecycleStatusEnum = z.enum(['alive', 'dead', 'employed'])
export type CustomerLifecycleStatus = z.infer<typeof CustomerLifecycleStatusEnum>

export const InteractionTypeEnum = z.enum(['call', 'email', 'meeting', 'visit', 'message', 'other'])
export type InteractionType = z.infer<typeof InteractionTypeEnum>

export const ReminderTypeEnum = z.enum(['call', 'email', 'visit', 'other'])
export type ReminderType = z.infer<typeof ReminderTypeEnum>

export const ReminderStatusEnum = z.enum(['pending', 'completed', 'overdue', 'cancelled'])
export type ReminderStatus = z.infer<typeof ReminderStatusEnum>

export const CollectorStatusEnum = z.enum(['active', 'inactive'])
export type CollectorStatus = z.infer<typeof CollectorStatusEnum>

export const InstallmentAccountCategoryEnum = z.enum(['A', 'B', 'C', 'D'])
export type InstallmentAccountCategory = z.infer<typeof InstallmentAccountCategoryEnum>

export const InstallmentAccountClassificationEnum = z.enum(['official', 'arrears', 'not_moving'])
export type InstallmentAccountClassification = z.infer<typeof InstallmentAccountClassificationEnum>

export const LegalEscalationStatusEnum = z.enum([
  'none',
  'soa_prepared',
  'demand_letter_sent',
  'small_claims_pack_ready',
  'filed',
])
export type LegalEscalationStatus = z.infer<typeof LegalEscalationStatusEnum>

export const InstallmentAccountStatusEnum = z.enum([
  'active',
  'closed',
  'early_closed',
  'written_off',
])
export type InstallmentAccountStatus = z.infer<typeof InstallmentAccountStatusEnum>

export const AgentStatusEnum = z.enum(['active', 'inactive'])
export type AgentStatus = z.infer<typeof AgentStatusEnum>

export const CollectionIncentiveStatusEnum = z.enum([
  'auto_approved',
  'pending_approval',
  'approved',
  'rejected',
])
export type CollectionIncentiveStatus = z.infer<typeof CollectionIncentiveStatusEnum>

export interface PipelineStage {
  id: string
  tenantId: string
  name: string
  orderIndex: number
  isWonStage: boolean
  isLostStage: boolean
  createdAt: string
  updatedAt: string
}

export interface Lead {
  id: string
  tenantId: string
  firstName: string
  lastName?: string | null
  company?: string | null
  email?: string | null
  phone?: string | null
  sourceChannel?: string | null
  stageId: string
  estimatedValue?: number | string | null
  assignedTo?: string | null
  branchId?: string | null
  convertedToCustomerId?: string | null
  notes?: string | null
  status: LeadStatus
  createdAt: string
  updatedAt: string
}

export interface CustomerBankAccount {
  id: string
  bankName: string
  accountNumber: string
  accountName?: string | null
  isPrimary: boolean
  createdAt: string
  updatedAt: string
}

export interface DuplicateCheckResult {
  duplicate: boolean
  matchedField?: 'email' | 'phone'
  customer?: { id: string; name: string }
}

export interface DuplicatePairCustomer {
  id: string
  customerCode: string
  name: string
  customerType: CustomerType
  email?: string | null
  phone?: string | null
  address?: string | null
  createdAt: string
}

export interface DuplicatePair {
  customerA: DuplicatePairCustomer
  customerB: DuplicatePairCustomer
  matchedField: 'email' | 'phone'
}

export interface CoMaker {
  id: string
  name: string
  relationship: string
  contactNumber: string
  email?: string | null
  createdAt: string
  updatedAt: string
}

export interface Customer {
  id: string
  tenantId: string
  customerCode: string
  name: string
  // Real stored name parts (developer-requested 2026-08-27) — null for a
  // customer created before these existed and never re-saved since.
  firstName?: string | null
  middleName?: string | null
  lastName?: string | null
  customerType: CustomerType
  companyName?: string | null
  businessCategory?: 'private' | 'government' | null
  employeeNumber?: string | null
  birthday?: string | null
  taxId?: string | null
  isTaxExempt: boolean
  taxExemptionRef?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  barangayCode?: string | null
  paymentTerms?: string | null
  creditLimit?: number | string | null
  groupId?: string | null
  sourceChannel: CustomerSourceChannel
  status: CustomerStatus
  notes?: string | null
  bankAccounts?: CustomerBankAccount[]
  coMakers?: CoMaker[]
  idType?: string | null
  idNumber?: string | null
  idDocumentFile?: {
    id: string
    originalName: string
    mimeType: string
    size: number
  } | null
  consentGiven: boolean
  consentGivenAt?: string | null
  createdAt: string
  updatedAt: string
  /** Only present when this response came from following an old, merged-away
   * customer id — the UI shows a notice instead of silently swapping data. */
  mergedFrom?: {
    id: string
    customerCode: string
    name: string
    mergedAt?: string | null
  }
}

export interface Agent {
  id: string
  tenantId: string
  name: string
  phone?: string | null
  email?: string | null
  status: AgentStatus
  commissionRate?: number | null
  createdAt: string
  updatedAt: string
}

export interface AgentCommission {
  id: string
  agentId: string
  posTransactionId: string
  baseAmount: number
  rate: number
  commissionAmount: number
  createdAt: string
  posTransaction: {
    transactionNumber: string
    totalAmount: number
    occurredAt: string
  }
}

export interface Interaction {
  id: string
  tenantId: string
  customerId?: string | null
  leadId?: string | null
  installmentAccountId?: string | null
  collectorId?: string | null
  contactPhone?: string | null
  interactionType: InteractionType
  summary: string
  outcome?: string | null
  isPromiseToPay?: boolean
  ptpAmount?: number | string | null
  ptpDate?: string | null
  loggedBy: string
  occurredAt: string
  createdAt: string
}

export interface Reminder {
  id: string
  tenantId: string
  customerId?: string | null
  leadId?: string | null
  installmentAccountId?: string | null
  collectorId?: string | null
  assignedTo: string
  reminderType: ReminderType
  dueAt: string
  note?: string | null
  status: ReminderStatus
  completedAt?: string | null
  isOverdue?: boolean
  createdAt: string
  customer?: { name: string } | null
  lead?: { firstName: string; lastName?: string | null } | null
  installmentAccount?: { accountNumber: string } | null
}

export interface CustomerSegment {
  id: string
  tenantId: string
  name: string
  description?: string | null
  ruleDefinition: Record<string, unknown>
  memberCount: number
  lastRefreshedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface Collector {
  id: string
  stubNumber: string
  name: string
  branchId?: string | null
  userId?: string | null
  status: CollectorStatus
  createdAt: string
  updatedAt: string
}

export interface CollectorRemittance {
  id: string
  collectorId: string
  amount: number | string
  remittedAt: string
  cashierId?: string | null
  reference?: string | null
  collectionBatch?: string | null
  notes?: string | null
  createdAt: string
}

export interface CollectorInstallmentAccountSummary {
  id: string
  accountNumber: string
  category?: InstallmentAccountCategory | null
  classification?: InstallmentAccountClassification | null
  currentBalance: number | string
}

export interface CollectorDetail extends Collector {
  branch?: { id: string; name: string; code: string } | null
  installmentAccounts: CollectorInstallmentAccountSummary[]
  remittances: CollectorRemittance[]
  areas: { barangayCode: string }[]
}

export interface AccountingCustomerLite {
  id: string
  name: string
  // Real stored name parts (developer-requested 2026-08-27) — null for a
  // customer created before these existed and never re-saved since; `name`
  // stays the field to display when they're not all present.
  firstName?: string | null
  middleName?: string | null
  lastName?: string | null
  phone?: string | null
  email?: string | null
}

export interface InstallmentAccount {
  id: string
  accountNumber: string
  customerId: string
  branchId?: string | null
  collectorId?: string | null
  currentBalance: number | string
  category?: InstallmentAccountCategory | null
  classification?: InstallmentAccountClassification | null
  inDam: boolean
  damEnteredAt?: string | null
  legalEscalationStatus?: LegalEscalationStatus
  legalEscalationNotes?: string | null
  legalEscalationUpdatedAt?: string | null
  status: InstallmentAccountStatus
  createdAt: string
  customer?: { name: string } | null
  branch?: { name: string } | null
  collector?: { stubNumber: string; name: string } | null
}

export interface InstallmentAccountDetail extends InstallmentAccount {
  arInvoiceId?: string | null
  installmentScheduleId?: string | null
  // Scenario 32 item 2 — the financing scheme this account was sold under
  // (WIP, CR-BR, SSC, TONIK, SKYRO, etc.). Null for hand-entered/imported
  // accounts (POS-only per developer decision, 2026-08-18).
  priceUseType?: { id: string; name: string } | null
  // Scenario 32 item 3 — the selling agent (manager/salesperson on the
  // paper card) this account was sold under. Same POS-only scoping.
  sellingAgent?: { id: string; name: string } | null
  // Scenario 32 item 4 — running totals, same for both POS-originated and
  // hand-entered accounts (unlike items 1/2/3/5 above, which are POS-only).
  totalPayments: number | string
  totalRebates: number | string
  totalBilling: number | string
  // Scenario 32 item 6 — IC on the paper card. A plain financing-terms
  // value, editable for either origin (not tied to POS checkout).
  insuranceCharge?: number | string | null
  // Scenario 32 item 6 — TMI on the paper card. Read-only copy of the
  // linked CreditApplication's totalMonthlyIncome, taken at creation time.
  // Null for hand-entered/imported accounts (same POS-only reasoning as
  // items 1/2/3/5 — a CreditApplication only ever exists for a POS sale).
  totalMonthlyIncome?: number | string | null
  // Scenario 32 item 5 — per-installment billing history, moved here from
  // Customer360's schedule-detail modal. Empty for hand-entered/imported
  // accounts (POS-only per developer decision, 2026-08-18).
  billingHistory: {
    lineNumber: number
    dueDate: string
    arInvoiceId: string
    invoiceNumber: string
    totalAmount: number | string
    amountPaid: number | string
    status: string
    // Developer-requested (2026-08-19): most recent non-cancelled payment
    // date on this invoice, or null if nothing's been paid yet.
    paidOn: string | null
  }[]
  // Scenario 32 item 1 — resolved via the linked InstallmentSchedule's
  // PosTransactionLines (mirrors Customer360's InstallmentScheduleDetailModal
  // pattern); always empty for hand-entered/imported accounts, which have no
  // linked schedule (POS-only per developer decision, 2026-08-18).
  unitItems: {
    id: string
    itemName: string | null
    // The paper ledger's "Type" field (e.g. "WASHING MACHINE") — distinct
    // from itemName/brand/modelNumber, the item's category.
    itemType: string | null
    modelNumber: string | null
    brand: string | null
    serialNumber: string | null
    secondarySerialNumber: string | null
  }[]
  listedCashPrice: number | string
  downPayment: number | string
  amountFinanced: number | string
  termMonths: number
  miFactor: number | string
  monthlyInstallment: number | string
  pnv: number | string
  totalPrice: number | string
  interestDifferential: number | string
  ppd: number | string
  openingBalance: number | string
  dpBalance: number | string
  lastOrNumber?: string | null
  lastOrDate?: string | null
  lastOrAmount?: number | string | null
  notYetDue: number | string
  totalDue: number | string
  miDue: number | string
  uncollected: number | string
  arrears: number | string
  penalty: number | string
  monthsRun: number
  points: number
  noArsSince?: string | null
  notMovingSince?: string | null
  closedAt?: string | null
  updatedAt: string
  customer: AccountingCustomerLite
  branch?: { id: string; name: string; code: string } | null
  collector?: { id: string; stubNumber: string; name: string } | null
  arInvoice?: { id: string; invoiceNumber: string; status: string } | null
}

// Chronological ledger row (Date/Ref/Inst./Description/Debit/Credit/Due/
// Outstanding) — format-matched to a legacy paper customer ledger, see
// InstallmentAccountService.getLedger()'s doc comment for the row scheme
// and which paper-form fields/rows aren't reproducible from this schema.
export interface InstallmentLedgerRow {
  date: string
  ref: string
  /** Installment line number this row belongs to; 0 for non-bill rows. */
  inst: number
  description: string
  debit: number
  credit: number
  /** This row's own net effect (debit − credit). */
  due: number
  outstanding: number
}

export interface InstallmentLedger {
  account: InstallmentAccountDetail
  saleReference: string | null
  saleDate: string | null
  firstInstallmentDate: string | null
  rows: InstallmentLedgerRow[]
}

// AR Aging Report — replicates a legacy "AGING OF ACCOUNTS RECEIVABLE" sheet,
// grouped Branch -> Collector. A row is either an installment account
// (installment-specific fields populated) or a standalone AR invoice with no
// linked installment account (those fields null — term/mi/fmiDate/dp/dpBal/
// miDue/pnlty/lcp/type). `over` (OVER-30 amount) is always null — no
// penalty/days-overdue rule exists yet to compute it from (deferred, not
// guessed). `noArs` is null, not 0, when an installment account's
// nextDueDate hasn't been backfilled yet — render as "needs review", not a
// fabricated value; for a standalone invoice row it's always computed from
// the invoice's own dueDate, never null.
export interface AgingReportRow {
  accountId: string
  accountNumber: string
  branchId: string | null
  branchName: string
  collectorId: string | null
  collectorLabel: string
  siNo: string
  siDate: string
  customerName: string
  address: string | null
  type: string | null
  term: number | null
  mi: number | null
  fmiDate: string | null
  dp: number | null
  dpBal: number | null
  ob: number
  miDue: number | null
  pnlty: number | null
  noArs: number | null
  mosRun: number
  totalPayt: number
  totalPrice: number
  totPricePercent: number
  lcp: number | null
  notMvg: number
  lastOrDate: string | null
  lastOrLastnum: string | null
  lastOrAmt: number | null
  over: number | null
}

export interface AgingReportSubtotal {
  count: number
  dp: number
  ob: number
  miDue: number
  pnlty: number
  totalPayt: number
  totalPrice: number
  lcp: number
}

export interface AgingReportCollectorGroup {
  collectorId: string | null
  collectorLabel: string
  rows: AgingReportRow[]
  subtotal: AgingReportSubtotal
}

export interface AgingReportBranchGroup {
  branchId: string | null
  branchName: string
  collectors: AgingReportCollectorGroup[]
  subtotal: AgingReportSubtotal
}

export interface AgingReportResponse {
  asOf: string
  branches: AgingReportBranchGroup[]
  grandTotal: AgingReportSubtotal
}

export const CategoryGraduationStatusEnum = z.enum(['pending', 'approved', 'rejected'])
export type CategoryGraduationStatus = z.infer<typeof CategoryGraduationStatusEnum>

export interface CategoryGraduationRequest {
  id: string
  installmentAccountId: string
  fromCategory?: InstallmentAccountCategory | null
  toCategory: InstallmentAccountCategory
  status: CategoryGraduationStatus
  requestedById?: string | null
  decidedById?: string | null
  decidedAt?: string | null
  notes?: string | null
  createdAt: string
  installmentAccount?: { id: string; accountNumber: string } | null
  requestedBy?: { id: string; name: string } | null
  decidedBy?: { id: string; name: string } | null
}

export const DamEscalationStatusEnum = z.enum(['pending', 'approved', 'rejected'])
export type DamEscalationStatus = z.infer<typeof DamEscalationStatusEnum>

export interface DamEscalationRequest {
  id: string
  installmentAccountId: string
  status: DamEscalationStatus
  requestedById?: string | null
  decidedById?: string | null
  decidedAt?: string | null
  reason?: string | null
  createdAt: string
  installmentAccount?: { id: string; accountNumber: string } | null
  requestedBy?: { id: string; name: string } | null
  decidedBy?: { id: string; name: string } | null
}

export interface CollectionIncentive {
  id: string
  collectorId: string
  branchId?: string | null
  installmentAccountId?: string | null
  category: InstallmentAccountCategory
  period: string
  amount: number | string
  status: CollectionIncentiveStatus
  approvedById?: string | null
  approvedAt?: string | null
  notes?: string | null
  isAutoGenerated?: boolean
  createdAt: string
  updatedAt: string
  collector?: { id: string; stubNumber: string; name: string } | null
  branch?: { id: string; name: string } | null
  installmentAccount?: { id: string; accountNumber: string } | null
  approvedBy?: { id: string; name: string; email?: string | null } | null
}

export interface PipelineColumn {
  stageId: string
  stageName: string
  isWonStage?: boolean
  isLostStage?: boolean
  leadCount: number
  totalValue: number
  leads: Lead[]
}

// Collections Calendar — day-grouped view of installment dues + reminders.
// Only dues bridged from a real POS InstallmentSchedule have a per-day due
// date (see backend CollectionsCalendarService) — hand-entered/imported
// InstallmentAccounts never appear in `payments`.
export interface CollectionsCalendarPayment {
  id: string
  dueDate: string
  amount: number
  arInvoiceId: string
  arInvoiceStatus: string
  outstanding: number
  customerId: string
  customerName: string
  installmentAccountId?: string | null
  accountNumber?: string | null
  branchId?: string | null
  branchName?: string | null
  collectorId?: string | null
  collectorName?: string | null
}

export interface CollectionsCalendarReminder {
  id: string
  dueAt: string
  reminderType: ReminderType
  status: ReminderStatus
  note?: string | null
  isOverdue: boolean
  customerId?: string | null
  customerName?: string | null
  leadId?: string | null
  leadName?: string | null
  installmentAccountId?: string | null
  accountNumber?: string | null
  collectorId?: string | null
  collectorName?: string | null
  assignedTo: string
}

export interface CollectionsCalendarResponse {
  range: { startDate: string; endDate: string }
  payments: CollectionsCalendarPayment[]
  reminders: CollectionsCalendarReminder[]
  meta: {
    totalPaymentsDue: number
    totalPaymentsAmount: number
    totalReminders: number
    totalOverdueReminders: number
  }
}

export interface PaginatedResponse<T> {
  data: T[]
  meta: {
    total: number
    page: number
    limit: number
    lastPage: number
  }
}
