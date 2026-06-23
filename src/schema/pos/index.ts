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

// POS Transaction
export type PosTransactionType = 'sale' | 'refund' | 'exchange'
export type PosTransactionStatus = 'completed' | 'voided'
export type PosInvoiceType = 'cash' | 'charge'
export type PosPaymentMethod =
  | 'cash'
  | 'card'
  | 'gift_card'
  | 'store_credit'
  | 'loyalty_points'
  | 'bank_transfer'
  | 'gcash'
  | 'paymaya'

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
  currency: string
  fxRate?: number | null
  isTaxExempt: boolean
  isOfflineSynced?: boolean
  status: PosTransactionStatus
  occurredAt: string
  createdAt: string
  journalEntryId?: string | null
  arInvoiceId?: string | null
  queueTicketNumber?: number | null
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
  customerId?: string
  originalTransactionId?: string
  promoCodeId?: string
  discountAmount?: number
  taxAmount?: number
  subtotal: number
  totalAmount: number
  isTaxExempt?: boolean
  taxExemptionRef?: string
  overrideManagerId?: string
  allowNegativeStock?: boolean
  currency?: string
  fxRate?: number
  notes?: string
  scPwdDiscount?: ScPwdDiscountInput
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
  lastName?: string
  phone?: string
  email?: string
}

export interface AddPaymentInput {
  paymentMethod: PosPaymentMethod
  amount: number
  giftCardId?: string
  referenceNumber?: string
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
  orderQueueCategoryId?: string | null
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
  orderQueueCategoryId?: string | null
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
