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
  /** Scenario 38 Gap 3 — required only when declaredClosingCash differs from
   *  the accounting-expected amount; posts the shortage/overage to the GL. */
  managerOverride?: boolean
  managerUserId?: string
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
  /** Named sub-choices (Scenario 37) — POS Terminal for card, bank for
   * bank_transfer, gateway for qr. Empty for methods with no sub-choice. */
  options: PaymentMethodOption[]
}

export interface PaymentMethodOption {
  id: string
  paymentMethodConfigId: string
  name: string
  isEnabled: boolean
  displayOrder: number
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
// 'charge' is no longer selectable from checkout (dropped in favor of Pay
// Now/Installment) — kept in the type only because historical transactions
// still carry it.
export type PosInvoiceType = 'cash' | 'charge' | 'installment'
// 'gcash'/'maya' are no longer offered from checkout (superseded by 'qr',
// Scenario 37) — kept in the type only because historical transactions still
// carry them.
export type PosPaymentMethod =
  | 'cash'
  | 'card'
  | 'gcash'
  | 'maya'
  | 'gift_card'
  | 'store_credit'
  | 'loyalty_points'
  | 'bank_transfer'
  | 'tpf'
  | 'qr'
  | 'custom'

// Which financing an installment line runs on: NIG's own underwriting
// (inhouse, the default) or an outside financing company that pays NIG in
// full at time of sale (tpf) — no local CreditApplication/PromissoryNote.
export type InstallmentProvider = 'inhouse' | 'tpf'

// Cosmetic sub-choice under a 'cash'-mode line — how the customer intends
// to pay, for receipt/reporting only. Never affects the PAYMENT section.
export type PayNowMethod = 'cash' | 'credit_card'

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
  secondarySerialNumber?: string | null
  invoiceType?: PosInvoiceType
  installmentProvider?: InstallmentProvider | null
  payNowMethod?: PayNowMethod | null
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
  /** Collection receipt reference for deliveryFee specifically — separate
   * from a payment's own CR/referenceNumber since the delivery fee is a
   * transaction-level charge, not tied to any one payment. */
  deliveryFeeReferenceNumber?: string | null
  /** Sales Invoice number — optional, free-text, once per whole transaction
   * (not per payment/tender like the per-payment CR/referenceNumber). */
  salesInvoiceNumber?: string | null
  /** Delivery Receipt number — same once-per-transaction convention as
   * salesInvoiceNumber above. */
  deliveryReceiptNumber?: string | null
  sellingAgent?: { id: string; name: string; email: string } | null
  lines?: PosTransactionLine[]
  payments?: PosPayment[]
  session?: PosSession
  invoices?: PosTransactionInvoice[]
  tpfProviderId?: string | null
  tpfReferenceNumber?: string | null
  tpfApprovedAmount?: number | null
  /** Present on create()/findOne() — one per distinct financing term used in
   * the cart. Used to split the down payment's tendered rows across
   * schedules via addPayment's installmentScheduleId. */
  installmentSchedules?: { id: string; downPayment: number }[]
}

// Scenario 23 Gap 1 — every invoice a transaction produced (the charge
// invoice, and/or each installment schedule's per-due-date invoices),
// flattened into one list for the transaction detail screen. `source`
// distinguishes the two cases; lineNumber/totalLines/termMonths are only
// set for installment-sourced rows.
export interface PosTransactionInvoice {
  id: string
  invoiceNumber: string
  dueDate: string
  totalAmount: number
  amountPaid: number
  status: string
  source: 'charge' | 'installment'
  lineNumber: number | null
  totalLines: number | null
  termMonths: number | null
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
  /** PriceListItem this line resolved to under the sale's selected Price
   * Use — omit if unitPrice was set via a manual price override instead. */
  priceListItemId?: string
  /** True when unitPrice was manually set by a PIN-approved manager
   * override rather than resolved from priceListItemId. */
  priceOverride?: boolean
  /** Per-line payment mode — lets one cart mix cash/installment lines.
   * Falls back to the transaction-level invoiceType when omitted. */
  invoiceType?: PosInvoiceType
  /** Which financing this installment line runs on — only meaningful when
   * invoiceType is 'installment'. Omit for inhouse (the default). */
  installmentProvider?: InstallmentProvider
  /** Cosmetic sub-choice for a 'cash'-mode line — how the customer intends
   * to pay, for receipt/reporting only. */
  payNowMethod?: PayNowMethod
  /** This line's own financing term (inhouse installment lines only). */
  financingTermId?: string
  /** This line's own down payment (inhouse installment lines only) — each
   * installment line carries its own down payment rather than one pooled
   * across the cart. */
  downPayment?: number
}

export interface CreateTransactionInput {
  sessionId: string
  /** Price Use category selected once for this whole sale (WIP/CR-BR/SSC/
   * PROMO/etc.) — every line resolves its price against this unless
   * individually overridden. */
  priceUseTypeId?: string
  transactionType?: PosTransactionType
  invoiceType?: PosInvoiceType
  chargeDueDays?: number
  /** installment invoices only */
  financingTermId?: string
  /** Scenario 17 Part 6 — inhouse installment invoices only, required. The
   * customer's approved, not-yet-used CreditApplication this sale fulfills. */
  creditApplicationId?: string
  /** inhouse installment invoices only — amount collected up front. Defaults to 0. */
  downPayment?: number
  /** TPF financing company backing this sale's TPF-mode line(s) — required
   * whenever any line has installmentProvider: 'tpf'. */
  tpfProviderId?: string
  /** This financier's own application/reference number — required
   * alongside tpfProviderId. */
  tpfReferenceNumber?: string
  /** The amount this financier approved, for audit/reconciliation only. */
  tpfApprovedAmount?: number
  customerId?: string
  originalTransactionId?: string
  promoCodeId?: string
  discountAmount?: number
  taxAmount?: number
  subtotal: number
  totalAmount: number
  /** Optional flat add-on collected now regardless of payment mode — never
   * counts toward an installment line's financed amount or its 10% down
   * payment floor. Defaults to 0. */
  deliveryFee?: number
  /** Collection receipt reference for deliveryFee specifically — separate
   * from a payment's own CR/referenceNumber since the delivery fee is a
   * transaction-level charge, not tied to any one payment. */
  deliveryFeeReferenceNumber?: string
  /** Sales Invoice number — optional, free-text, once per whole transaction
   * (not per payment/tender like the per-payment CR/referenceNumber). */
  salesInvoiceNumber?: string
  /** Delivery Receipt number — same once-per-transaction convention as
   * salesInvoiceNumber above. */
  deliveryReceiptNumber?: string
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
  sellingAgentId?: string
  lines: CreateTransactionLineInput[]
}

// Scenario 03, Part 3 — SKU-level reservation ("Reserve" checkout mode).
// Deliberately NOT a PosTransaction — reserving an item never creates a
// sale; it creates a SkuReservation (+ optional CustomerAdvance deposit).
// Full lifecycle (Parts 4-6): open -> earmarked -> fulfilled, or
// open/earmarked -> cancel_requested -> cancelled/back.
export type SkuReservationStatus =
  | 'open'
  | 'earmarked'
  | 'fulfilled'
  | 'cancel_requested'
  | 'cancelled'

export interface SkuReservation {
  id: string
  branchId: string
  branch?: { id: string; name: string; code: string }
  itemId: string
  item?: { id: string; sku: string; name: string; sellingPrice: number }
  customerId: string
  customer?: { id: string; customerCode: string; name: string }
  quantity: number
  depositAmount: number
  amountPaid: number
  status: SkuReservationStatus
  earmarkedSerialNumberId?: string | null
  earmarkedAt?: string | null
  earmarkedWarehouseId?: string | null
  fulfilledAt?: string | null
  fulfilledJournalEntryId?: string | null
  cancelRequestedById?: string | null
  cancelRequestedAt?: string | null
  cancelReason?: string | null
  cancelActedById?: string | null
  cancelActedAt?: string | null
  cancelRejectedReason?: string | null
  notes?: string | null
  createdAt: string
}

export interface CreateSkuReservationInput {
  itemId: string
  customerId: string
  quantity: number
  notes?: string
}

export interface SkuReservationFilters {
  status?: SkuReservationStatus
  itemId?: string
  customerId?: string
  branchId?: string
}

export interface FulfilSkuReservationInput {
  paymentMethod?: string
}

export type CustomerAdvanceStatus = 'ACTIVE' | 'APPLIED' | 'REFUNDED'

export interface CustomerAdvance {
  id: string
  branchId: string
  customerId: string
  amount: number
  unappliedAmount: number
  referenceType: string
  referenceId: string
  paymentMethod?: string | null
  status: CustomerAdvanceStatus
  journalEntryId?: string | null
  createdAt: string
}

export interface CreateCustomerAdvanceInput {
  customerId: string
  amount: number
  referenceType: string
  referenceId: string
  paymentMethod?: string
}

export interface CustomerAdvanceFilters {
  status?: CustomerAdvanceStatus
  customerId?: string
  referenceType?: string
  referenceId?: string
  branchId?: string
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

// POS Collections — one row per customer with at least one outstanding
// installment due, aggregated across all their installment schedules.
export interface CollectionsCustomer {
  id: string
  name: string
  phone: string | null
  outstandingCount: number
  outstandingAmount: number
  // Scenario 29 ACC-05 — the collector's number: only installment lines
  // whose own due date has actually passed, unlike outstandingAmount
  // above (which counts every open line regardless of maturity).
  dueCount: number
  dueAmount: number
  nextDueDate: string
}

export interface CreateWalkInCustomerInput {
  firstName: string
  middleName?: string
  lastName: string
  phoneNumber: string
  email?: string
  customerType?: import('@/src/schema/crm/types').CustomerType
  companyName?: string
  businessCategory?: 'private' | 'government'
  employeeNumber?: string
  birthday?: Date
  groupId?: string
  taxId?: string
  isTaxExempt?: boolean
  taxExemptionRef?: string
  address?: string
  barangayCode?: string
  paymentTerms?: string
  status?: import('@/src/schema/crm/types').CustomerStatus
  note?: string
  coMakers?: import('@/src/schema/crm/customer').CoMakerFormValues[]
  idType?: string
  idNumber?: string
  idDocumentFileId?: string
  consentGiven?: boolean
  consentGivenAt?: Date
}

// card only — straight charge vs. the card issuer's own installment plan
// (Scenario 37). Captured only, never calculated.
export type PosCardTxnMode = 'straight' | 'installment'

export interface AddPaymentInput {
  paymentMethod: PosPaymentMethod
  amount: number
  giftCardId?: string
  referenceNumber?: string
  paymentMethodConfigId?: string
  /** Named sub-choice used (Scenario 37) — POS Terminal for card, bank for
   * bank_transfer, gateway for qr. */
  paymentMethodOptionId?: string
  cardTxnMode?: PosCardTxnMode
  /** Months (3/6/9/12/18/24) — required when cardTxnMode is 'installment'. */
  cardInstallmentTerm?: number
  /** Scenario 38 Gap 7 — bank_transfer only. The cashier confirmed the
   * credit already landed at the register, so this posts straight to Cash
   * in Bank instead of the usual clearing account. */
  bankTransferVerifiedAtRegister?: boolean
  currency?: string
  fxRate?: number
  notes?: string
  /** Tags this payment as funding a specific installment schedule's down
   * payment, instead of the transaction's cash/TPF total — restricts
   * paymentMethod to cash/bank_transfer/qr/card server-side. */
  installmentScheduleId?: string
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

// Cross-branch stock — one entry per warehouse currently holding this item
// (POS-15). The backend returns a bare array (pos-inventory.service.ts's
// crossBranchStock), not the {message, itemId, branches} shape this type
// used to claim — nothing actually reads those old fields today.
export interface CrossBranchStockEntry {
  availableQty: number
  onHandQty: number
  warehouse: { id: string; name: string; code: string; branchId: string | null }
}
export type CrossBranchStockResult = CrossBranchStockEntry[]

// Branch Pricing
export interface BranchPricing {
  id: string
  branchId: string
  itemId: string
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
  termMonths?: number
  factorRate?: number
  isActive?: boolean
  notes?: string
}

// TPF (third-party financing) Providers
export interface TpfProvider {
  id: string
  tenantId: string
  name: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateTpfProviderInput {
  name: string
}

export interface UpdateTpfProviderInput {
  name?: string
  isActive?: boolean
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
    /** Non-cancelled payments only — used to warn "already collected today"
     * before the Collect modal is even opened. */
    payments: { paymentDate: string; amount: number }[]
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
  // Scenario 23 Gap 2 — plural since Gap 5's term-grouping means a schedule
  // can cover several items sharing one term, not just one.
  posTransactionLines: {
    id: string
    itemId: string
    quantity: number
    unitPrice: number
    lineTotal: number
    item: { name: string; brand: { name: string } | null } | null
    serialNumber: { id: string; serialNumber: string } | null
    secondarySerialNumber: { id: string; serialNumber: string } | null
  }[]
  // ppd is the rebate — fixed 7.5% of the monthly installment. status is the
  // plan's overall finished/ongoing state (closed/early_closed/written_off
  // all mean "no longer active", just via different paths — see Customer360's
  // InstallmentPlanStatusBadge). Null if this schedule has no linked
  // InstallmentAccount (shouldn't normally happen, every POS installment
  // line creates one, but the relation is optional).
  installmentAccount: {
    id: string
    ppd: number
    status: 'active' | 'closed' | 'early_closed' | 'written_off'
  } | null
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
  /** Per-line payment mode (2026-08-06) — falls back to the cart snapshot's
   * own invoiceType when a line omits it, same as the backend's
   * lineInvoiceType resolution. */
  invoiceType?: PosInvoiceType
  financingTermId?: string
  downPayment?: number
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
  creditApplicationId?: string
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
  /** Only populated once approved — mirrors the same transaction number
   * shown in this request's resolution notification title (see
   * ReleaseFormRequestsService.notifyResolved on the backend). */
  createdTransaction?: { transactionNumber: string } | null
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
  /** Scenario 17 Part 7 — generated for installment sales only; empty for
   * plain RFD/charge requests. Per-line financing (2026-08-06) means one
   * note per installment line, not one per request. Release is blocked in
   * approve() until every note's signedAt is set. */
  promissoryNotes?: {
    id: string
    creditApplicationId: string
    lineIndex: number
    termMonths: number
    factorRate: number
    totalAmount: number
    downPayment: number
    amountFinanced: number
    totalPayable: number
    monthlyInstallment: number
    scheduleLines: { lineNumber: number; dueDate: string; amount: number }[]
    generatedAt: string
    signedAt?: string | null
    signedById?: string | null
  }[]
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
