// POS Terminal
export type PosTerminalStatus = 'active' | 'inactive'

export interface PosTerminal {
  id: string
  terminalCode: string
  name: string
  branchId: string
  status: PosTerminalStatus
  description?: string | null
  createdAt: string
  updatedAt: string
  branch?: { id: string; name: string }
}

// Cashier Terminal Access
export interface CashierTerminalAccess {
  id: string
  userId: string
  terminalId: string
  createdAt: string
  user: { id: string; name: string | null; email: string | null }
}

export interface CreateTerminalInput {
  terminalCode: string
  name: string
  branchId: string
  status?: PosTerminalStatus
  description?: string
}

export interface UpdateTerminalInput {
  name?: string
  branchId?: string
  status?: PosTerminalStatus
  description?: string
}

// POS Session
export type PosSessionStatus = 'open' | 'closed' | 'handed_over'

export interface PosSession {
  id: string
  terminalId: string
  cashierId: string
  openedAt: string
  openingCash: number
  closedAt?: string | null
  declaredClosingCash?: number | null
  expectedClosingCash?: number | null
  cashVariance?: number | null
  handedOverTo?: string | null
  status: PosSessionStatus
  createdAt: string
  updatedAt: string
  terminal?: PosTerminal
  cashier?: { id: string; name: string; email: string }
  _count?: { transactions: number }
}

export interface OpenSessionInput {
  terminalId: string
  openingCash: number
  notes?: string
  cashierId?: string
}

export interface CloseSessionInput {
  declaredClosingCash: number
  notes?: string
  denominationBreakdown?: Record<string, number>
}

export interface SessionReconciliation {
  sessionId: string
  openingCash: number
  expectedClosingCash: number
  declaredClosingCash: number
  cashVariance: number
  paymentBreakdown: Record<string, number>
}

export interface SalesSummary {
  date: string
  totalSales: number
  totalRefunds: number
  netSales: number
  transactionCount: number
}

// Payment Method Configuration
export type PaymentMethodType = 'standard' | 'custom'

export interface PaymentMethodConfig {
  id: string
  key: string | null
  name: string
  label: string
  type: PaymentMethodType
  isEnabled: boolean
  displayOrder: number
  glAccountId: string | null
  referenceFieldLabel: string | null
  referenceFieldRegex: string | null
  referenceIsRequired: boolean
}

export interface CreateCustomPaymentMethodInput {
  name: string
  label: string
  referenceFieldLabel?: string
  referenceFieldRegex?: string
  referenceIsRequired?: boolean
  glAccountId?: string
}

// POS Transaction
export type PosTransactionType = 'sale' | 'refund' | 'exchange'
export type PosTransactionStatus = 'completed' | 'voided'
export type PosInvoiceType = 'cash' | 'charge' | 'installment'
export type PosPaymentMethod =
  | 'cash'
  | 'card'
  | 'gcash'
  | 'maya'
  | 'gift_card'
  | 'store_credit'
  | 'loyalty_points'
  | 'bank_transfer'
  | 'custom'

export interface BranchPaymentMethod extends PaymentMethodConfig {
  isOverridden: boolean
  tenantEnabled: boolean
}

export interface BranchPaymentMethodsResponse {
  data: BranchPaymentMethod[]
  meta: { branchId: string; branchName: string }
}

export interface BranchReceiptConfig {
  logoUrl: string | null
  headerText: string | null
  footerText: string | null
  overrides: { logoUrl: boolean; headerText: boolean; footerText: boolean }
}

export interface BranchReceiptConfigResponse {
  data: BranchReceiptConfig
  meta: { branchId: string; branchName: string }
}

export interface PosTransactionLine {
  id: string
  itemId: string
  itemName: string
  sku?: string | null
  quantity: number
  unitPrice: number
  discountAmount: number
  taxAmount: number
  lineTotal: number
  notes?: string | null
  serialNumber?: string | null
}

export interface PosPayment {
  id: string
  paymentMethod: PosPaymentMethod
  amount: number
  referenceNumber?: string | null
  giftCardId?: string | null
  createdAt: string
}

export interface PosTransaction {
  id: string
  transactionNumber: string
  sessionId: string
  transactionType: PosTransactionType
  invoiceType?: PosInvoiceType
  customerId?: string | null
  promoCodeId?: string | null
  subtotal: number
  discountTotal: number
  taxTotal: number
  totalAmount: number
  vatableAmount?: number | null
  vatExemptAmount?: number | null
  zeroRatedAmount?: number | null
  taxRoundingAdjustment?: number | null
  scPwdDiscountType?: 'SC' | 'PWD' | null
  scPwdIdNumber?: string | null
  scPwdName?: string | null
  scPwdDiscountTotal?: number | null
  currency: string
  fxRate?: number | null
  isTaxExempt: boolean
  isOfflineSynced?: boolean
  status: PosTransactionStatus
  occurredAt: string
  createdAt: string
  journalEntryId?: string | null
  arInvoiceId?: string | null
  sellingAgent?: { id: string; name: string; email: string } | null
  lines?: PosTransactionLine[]
  payments?: PosPayment[]
  session?: PosSession
}

export interface CreateTransactionLineInput {
  itemId: string
  variantId?: string
  itemName: string
  sku?: string
  quantity: number
  unitPrice: number
  discountAmount?: number
  taxAmount?: number
  pricingMode?: 'inclusive' | 'exclusive'
  notes?: string
  serialNumberId?: string
  secondarySerialNumberId?: string
}

export interface ScPwdDiscountInput {
  type: 'SC' | 'PWD'
  idNumber: string
  name: string
  signatureCapture: string
}

export interface CreateTransactionInput {
  sessionId: string
  transactionType?: PosTransactionType
  invoiceType?: PosInvoiceType
  chargeDueDays?: number
  /** installment invoices only */
  financingTermId?: string
  /** installment invoices only — amount collected up front. Defaults to 0. */
  downPayment?: number
  customerId?: string
  originalTransactionId?: string
  promoCodeId?: string
  discountAmount?: number
  taxAmount?: number
  subtotal: number
  totalAmount: number
  isTaxExempt?: boolean
  taxExemptionRef?: string
  /** Set when a manager has PIN-approved an override (receiptless return,
   * discount threshold, or charge-sale credit/terms block). */
  managerOverride?: boolean
  managerUserId?: string
  allowNegativeStock?: boolean
  currency?: string
  fxRate?: number
  notes?: string
  /** Mandatory when transactionType is 'refund' — the backend rejects a
   * refund submission with no reason. */
  reason?: string
  scPwdDiscount?: ScPwdDiscountInput
  sellingAgentId?: string
  lines: CreateTransactionLineInput[]
}

// Customer (lightweight shape used in POS checkout)
export interface PosCustomer {
  id: string
  name?: string
  firstName?: string
  lastName?: string
  phone?: string
  email?: string
}

export interface CreateWalkInCustomerInput {
  firstName: string
  lastName: string
  phoneNumber: string
  email?: string
}

export interface AddPaymentInput {
  paymentMethod: PosPaymentMethod
  amount: number
  giftCardId?: string
  referenceNumber?: string
  paymentMethodConfigId?: string
  currency?: string
  fxRate?: number
  notes?: string
}

// Parked Sale
export type ParkedSaleStatus = 'parked' | 'resumed' | 'cancelled'

export interface ParkedSale {
  id: string
  terminalId: string
  label: string
  cartData: Record<string, unknown>
  parkedBy: string
  parkedAt: string
  resumedAt?: string | null
  status: ParkedSaleStatus
  createdAt: string
  terminal?: PosTerminal
}

export interface ParkSaleInput {
  sessionId: string
  terminalId: string
  label: string
  cartData: Record<string, unknown>
}

// Promo Code
export type PromoDiscountType = 'percentage' | 'fixed_amount' | 'bogo'
export type PromoStatus = 'active' | 'paused' | 'expired'

export interface PromoCode {
  id: string
  code: string
  name: string
  description?: string | null
  discountType: PromoDiscountType
  discountValue: number
  minPurchaseAmount?: number | null
  maxUsesTotal?: number | null
  maxUsesPerCustomer?: number | null
  currentUses: number
  validFrom?: string | null
  validUntil?: string | null
  applicableItems?: string[]
  status: PromoStatus
  createdAt: string
  updatedAt: string
}

export interface CreatePromoCodeInput {
  code: string
  name: string
  description?: string
  discountType: PromoDiscountType
  discountValue: number
  minPurchaseAmount?: number
  validFrom?: string
  validUntil?: string
  maxUsesTotal?: number
  maxUsesPerCustomer?: number
  applicableItems?: string[]
  status?: PromoStatus
}

export interface UpdatePromoCodeInput extends Partial<CreatePromoCodeInput> {}

export interface ValidatePromoCodeInput {
  code: string
  orderTotal: number
  customerId?: string
  itemIds?: string[]
}

export interface PromoValidationResult {
  valid: boolean
  promoCode?: PromoCode
  discountAmount?: number
  message?: string
}

// Gift Card
export type GiftCardStatus = 'active' | 'depleted' | 'expired' | 'voided'

export interface GiftCard {
  id: string
  cardNumber: string
  initialValue: number
  currentBalance: number
  currency: string
  issuedAt: string
  issuedToCustomerId?: string | null
  expiresAt?: string | null
  status: GiftCardStatus
  createdAt: string
  updatedAt: string
}

export interface IssueGiftCardInput {
  cardNumber: string
  initialValue: number
  currency?: string
  issuedToCustomerId?: string
  expiresAt?: string
  status?: GiftCardStatus
}

// Loyalty
export type LoyaltyEventType = 'earned' | 'redeemed' | 'expired' | 'adjusted'

export interface LoyaltyAccount {
  id: string
  customerId: string
  currentPoints: number
  lifetimeEarned: number
  lifetimeRedeemed: number
  tier?: string | null
  createdAt: string
  updatedAt: string
}

export interface LoyaltyTransaction {
  id: string
  loyaltyAccountId: string
  posTransactionId?: string | null
  eventType: LoyaltyEventType
  pointsChange: number
  balanceAfter: number
  createdAt: string
}

export interface EarnPointsInput {
  points: number
  transactionAmount?: number
  notes?: string
  posTransactionId?: string
}

export interface RedeemPointsInput {
  points: number
  orderTotal?: number
  notes?: string
  posTransactionId?: string
}

export interface CreateLoyaltyAccountInput {
  customerId: string
  currentPoints?: number
}

export interface LoyaltyProgram {
  id: string
  tenantId: string
  pointsPerUnit: number
  pointsValue: number
  maxRedeemPct: number
  minimumRedeem: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateLoyaltyProgramInput {
  tenantId: string
  pointsPerUnit: number
  pointsValue: number
  maxRedeemPct: number
  minimumRedeem: number
  isActive?: boolean
}

export interface UpdateLoyaltyProgramInput {
  pointsPerUnit?: number
  pointsValue?: number
  maxRedeemPct?: number
  minimumRedeem?: number
  isActive?: boolean
}

export interface PosConfig {
  id: string
  tenantId: string
  discountOverrideThreshold: number
  receiptlessReturnDays: number
  allowNegativeStock?: boolean
  defaultPricingMode?: 'inclusive' | 'exclusive'
  createdAt: string
  updatedAt: string
}

export interface CreatePosConfigInput {
  tenantId: string
  discountOverrideThreshold: number
  receiptlessReturnDays: number
  allowNegativeStock?: boolean
}

export interface UpdatePosConfigInput {
  discountOverrideThreshold?: number
  receiptlessReturnDays?: number
  allowNegativeStock?: boolean
  defaultPricingMode?: 'inclusive' | 'exclusive'
}

// Cash Drawer
export type CashDrawerEventType = 'no_sale_open' | 'cash_drop' | 'petty_cash_in' | 'petty_cash_out'

export interface CashDrawerEvent {
  id: string
  sessionId: string
  eventType: CashDrawerEventType
  amount?: number | null
  authorizedByUserId?: string | null
  notes?: string | null
  occurredAt: string
  createdAt: string
}

export interface CreateCashDrawerEventInput {
  sessionId: string
  eventType: CashDrawerEventType
  amount?: number
  authorizedByUserId?: string
  notes?: string
}

// Session Handover
export interface HandoverSessionInput {
  incomingCashierId: string
  declaredCash: number
  notes?: string
}

export interface HandoverSessionResult {
  handedOverSession: string
  newSession: PosSession
}

// Receipt
export interface SendReceiptInput {
  email?: string
  phone?: string
}

export interface SendReceiptResult {
  message: string
  transactionId: string
}

// Offline Sync
export interface SyncTransactionItem extends CreateTransactionInput {
  isOfflineSynced: boolean
  transactionNumber?: string
  offlinePaymentMethods?: string[]
}

export interface SyncTransactionsInput {
  transactions: SyncTransactionItem[]
}

export interface SyncTransactionsResult {
  synced: number
  skipped: number
  errors: Array<{ index: number; error: string }>
  pendingManagerReview?: Array<{ index: number; transactionNumber?: string; reason: string }>
}

// Gift Card History
export interface GiftCardHistoryEntry {
  id: string
  giftCardId: string
  type: 'issued' | 'used' | 'voided' | 'adjusted'
  amount: number
  balanceBefore: number
  balanceAfter: number
  referenceId?: string | null
  notes?: string | null
  occurredAt: string
  createdAt: string
}

// Customer-facing session display
export interface SessionDisplayLine {
  itemName: string
  quantity: number
  unitPrice: number
  lineTotal: number
}

export interface SessionDisplay {
  sessionId: string
  status: 'idle' | 'active'
  lines: SessionDisplayLine[]
  subtotal: number
  discountTotal: number
  taxTotal: number
  totalAmount: number
  currency: string
  updatedAt: string
}

// Cross-branch stock
export interface CrossBranchStockResult {
  message: string
  itemId: string
  branches: unknown[]
}

// Branch Pricing
export interface BranchPricing {
  id: string
  branchId: string
  itemId: string
  variantId?: string | null
  price: number
  taxRate?: number | null
  pricingMode?: 'inclusive' | 'exclusive' | null
  effectiveFrom?: string | null
  effectiveTo?: string | null
  notes?: string | null
  createdAt: string
  updatedAt: string
  branch?: { id: string; name: string }
  item?: { id: string; name: string } | null
}

export interface CreateBranchPricingInput {
  branchId: string
  itemId: string
  variantId?: string
  price: number
  taxRate?: number
  pricingMode?: 'inclusive' | 'exclusive'
  effectiveFrom?: string
  effectiveTo?: string
  notes?: string
}

export interface UpdateBranchPricingInput {
  price?: number
  taxRate?: number
  pricingMode?: 'inclusive' | 'exclusive'
  effectiveFrom?: string
  effectiveTo?: string
  notes?: string
}

// Financing Terms (Phase 3 — Installment Financing)
export interface FinancingTerm {
  id: string
  tenantId: string
  branchId?: string | null
  branch?: { id: string; name: string } | null
  termMonths: number
  factorRate: number
  isActive: boolean
  notes?: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateFinancingTermInput {
  branchId?: string
  termMonths: number
  factorRate: number
  notes?: string
}

export interface UpdateFinancingTermInput {
  factorRate?: number
  isActive?: boolean
  notes?: string
}

export interface InstallmentPreviewLine {
  lineNumber: number
  dueDate: string
  amount: number
}

export interface InstallmentPreview {
  amountFinanced: number
  totalPayable: number
  monthlyInstallment: number
  lines: InstallmentPreviewLine[]
}

export interface ComputeInstallmentPreviewInput {
  totalAmount: number
  downPayment?: number
  financingTermId: string
}

export interface InstallmentScheduleLineWithInvoice {
  lineNumber: number
  dueDate: string
  amount: number
  arInvoice: {
    id: string
    invoiceNumber: string
    dueDate: string
    totalAmount: number
    amountPaid: number
    status: string
  }
}

export interface InstallmentSchedule {
  id: string
  termMonths: number
  factorRate: number
  downPayment: number
  amountFinanced: number
  monthlyInstallment: number
  totalPayable: number
  createdAt: string
  posTransaction?: { transactionNumber: string; occurredAt: string }
  financingTerm?: { termMonths: number; factorRate: number }
  lines: InstallmentScheduleLineWithInvoice[]
}

// Void Requests
export type PosVoidRequestStatus = 'pending' | 'approved' | 'rejected'
export type PosVoidRequestType = 'void' | 'edit'

export interface PosVoidRequest {
  id: string
  tenantId?: string | null
  transactionId: string
  requestType: PosVoidRequestType
  requestedById: string
  reason: string
  status: PosVoidRequestStatus
  reviewedById?: string | null
  reviewNotes?: string | null
  createdAt: string
  reviewedAt?: string | null
  transaction?: {
    transactionNumber: string
    totalAmount: number
    occurredAt: string
  }
  requestedBy?: {
    name: string | null
    employee?: { employeeCode: string } | null
  } | null
  reviewedBy?: {
    name: string | null
    employee?: { employeeCode: string } | null
  } | null
}

export interface SubmitVoidRequestInput {
  reason: string
  requestType?: PosVoidRequestType
}

export interface ReviewVoidRequestInput {
  reviewNotes?: string
}

// ─── Cancellation Requests ────────────────────────────────────────────────────

export type PosCancellationStatus = 'pending' | 'approved' | 'rejected'

export interface PosCancellationRequest {
  id: string
  tenantId?: string | null
  sessionId: string
  requestedById: string
  reason: string
  cartSnapshot?: Record<string, unknown>[] | null
  status: PosCancellationStatus
  reviewedById?: string | null
  reviewNotes?: string | null
  createdAt: string
  reviewedAt?: string | null
  session?: {
    cashier?: { id: string; name: string } | null
    terminal?: { terminalCode: string; branch?: { name: string } | null } | null
  }
}

export interface SubmitCancellationInput {
  reason: string
  cartSnapshot?: Record<string, unknown>[]
}

export interface ReviewCancellationInput {
  reviewNotes?: string
}

// ─── Release Form Requests (serial-tracked sale approval) ────────────────────

export type PosReleaseFormStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'expired'

/** Response shape when POST /pos/transactions defers to manager approval
 * instead of completing the sale immediately. */
export interface PosTransactionPendingApproval {
  status: 'pending_approval'
  releaseFormRequestId: string
  sessionId: string
}

export type CreateTransactionResult =
  | PosTransaction
  | PosTransactionPendingApproval
  | PosRefundPendingApproval

export function isPendingApproval(
  data: CreateTransactionResult
): data is PosTransactionPendingApproval {
  return (data as PosTransactionPendingApproval)?.status === 'pending_approval'
}

export interface PosReleaseFormCartLine {
  itemId: string
  itemName: string
  sku?: string
  quantity: number
  unitPrice: number
  discountAmount?: number
  taxAmount?: number
  serialNumberId?: string
  serialNumberLabel?: string
  serialNumber?: string
}

export interface PosReleaseFormCartSnapshot {
  sessionId?: string
  customerId?: string | null
  customer?: { id: string; name?: string | null } | null
  lines?: PosReleaseFormCartLine[]
  subtotal?: number
  discountAmount?: number
  discountTotal?: number
  taxAmount?: number
  taxTotal?: number
  totalAmount?: number
  invoiceType?: PosInvoiceType
  financingTermId?: string
  downPayment?: number
}

export interface PosReleaseFormRequest {
  id: string
  tenantId?: string | null
  sessionId: string
  requestedById: string
  status: PosReleaseFormStatus
  reviewedById?: string | null
  reviewNotes?: string | null
  createdAt: string
  reviewedAt?: string | null
  createdTransactionId?: string | null
  cartSnapshot: PosReleaseFormCartSnapshot
  requestedBy?: {
    name: string | null
    employee?: { employeeCode: string } | null
  } | null
  reviewedBy?: {
    name: string | null
    employee?: { employeeCode: string } | null
  } | null
  session?: {
    cashier?: { id: string; name: string } | null
    terminal?: { terminalCode: string; name?: string; branch?: { name: string } | null } | null
  } | null
  /** Derived label — no dedicated model. Whether this is a plain RFD (serial
   * hold), a credit-sale Application Form, or both. */
  requestType?: 'RFD' | 'Application Form' | 'RFD + Application Form'
  /** Live-computed credit/terms concerns for a charge sale (COD terms, over
   * Net-N days, over credit limit) — advisory only, empty for cash sales. */
  creditWarnings?: string[]
}

export interface ReleaseFormStatusResult {
  status: PosReleaseFormStatus
  reviewedAt?: string | null
  reviewNotes?: string | null
  createdTransactionId?: string | null
}

export interface ReviewReleaseFormInput {
  reviewNotes?: string
}

// ─── Return/Refund Requests (unified cancellation/void/refund approval queue) ─
// Backend unifies the three legacy approval mechanisms (cancellation, void,
// refund) onto a single ReturnRefundRequest model. Cancellation and void keep
// their own dedicated pages (resolving any already-pending old-model rows);
// this queue is the NEW shared surface going forward for all three types.

export type PosReturnRefundType = 'cancellation' | 'void' | 'refund'
export type PosReturnRefundStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'expired'

export interface PosReturnRefundRequest {
  id: string
  tenantId?: string | null
  type: PosReturnRefundType
  sessionId: string
  /** Dual-purpose on the backend: the source transaction for type='void',
   * and the *result* transaction (set on approval) for type='refund'. */
  transactionId?: string | null
  requestedById: string
  reason?: string | null
  status: PosReturnRefundStatus
  reviewedById?: string | null
  reviewNotes?: string | null
  createdAt: string
  reviewedAt?: string | null
  /** Present for refund requests only (cart-snapshot based) — the wire
   * field is refundCartSnapshot, not cartSnapshot. */
  refundCartSnapshot?: PosReleaseFormCartSnapshot | null
  requestedBy?: {
    name: string | null
    employee?: { employeeCode: string } | null
  } | null
  reviewedBy?: {
    name: string | null
    employee?: { employeeCode: string } | null
  } | null
  session?: {
    cashier?: { id: string; name: string } | null
    terminal?: { terminalCode: string; name?: string; branch?: { name: string } | null } | null
  } | null
  /** Present for void requests (transaction-based, not cart-snapshot based). */
  transaction?: {
    transactionNumber: string
    totalAmount: number
    occurredAt: string
  } | null
}

export interface ReturnRefundStatusResult {
  status: PosReturnRefundStatus
  reviewedAt?: string | null
  reviewNotes?: string | null
  /** Set once a refund request is approved — the newly-created transaction. */
  transactionId?: string | null
}

export interface ReviewReturnRefundInput {
  reviewNotes?: string
}

/** Response shape when POST /pos/transactions defers a refund to manager
 * approval instead of completing it immediately. Mirrors
 * PosTransactionPendingApproval's release-form shape with the return-refund
 * id field instead. */
export interface PosRefundPendingApproval {
  status: 'pending_approval'
  returnRefundRequestId: string
  sessionId: string
}

export function isRefundPendingApproval(
  data: CreateTransactionResult
): data is PosRefundPendingApproval {
  return (
    (data as PosRefundPendingApproval)?.status === 'pending_approval' &&
    'returnRefundRequestId' in data
  )
}
