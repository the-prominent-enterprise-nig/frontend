'use server'

import { api, ApiResponse } from '@/src/libs/api/client'
import { revalidateTag } from 'next/cache'
import { getSessionOrNull } from '@/src/libs/auth/actions/get-session'
import type {
  PosCustomer,
  CreateWalkInCustomerInput,
  PosTerminal,
  CashierTerminalAccess,
  PaymentMethodConfig,
  CreateCustomPaymentMethodInput,
  CreateTerminalInput,
  UpdateTerminalInput,
  PosSession,
  OpenSessionInput,
  CloseSessionInput,
  SessionReconciliation,
  SalesSummary,
  PosTransaction,
  CreateTransactionInput,
  AddPaymentInput,
  PromoCode,
  CreatePromoCodeInput,
  UpdatePromoCodeInput,
  ValidatePromoCodeInput,
  PromoValidationResult,
  GiftCard,
  IssueGiftCardInput,
  LoyaltyAccount,
  LoyaltyTransaction,
  EarnPointsInput,
  RedeemPointsInput,
  CreateLoyaltyAccountInput,
  LoyaltyProgram,
  CreateLoyaltyProgramInput,
  UpdateLoyaltyProgramInput,
  PosConfig,
  CreatePosConfigInput,
  UpdatePosConfigInput,
  CashDrawerEvent,
  CreateCashDrawerEventInput,
  BranchPricing,
  CreateBranchPricingInput,
  UpdateBranchPricingInput,
  ParkedSale,
  ParkSaleInput,
  HandoverSessionInput,
  HandoverSessionResult,
  SendReceiptInput,
  SendReceiptResult,
  SyncTransactionsInput,
  SyncTransactionsResult,
  CrossBranchStockResult,
  GiftCardHistoryEntry,
  SessionDisplay,
  PosVoidRequest,
  SubmitVoidRequestInput,
  ReviewVoidRequestInput,
  PosCancellationRequest,
  SubmitCancellationInput,
  ReviewCancellationInput,
} from '@/src/schema/pos'
import type { BranchPaymentMethod, PosPaymentMethod } from '@/src/schema/pos'

const TAGS = {
  terminals: 'pos-terminals',
  terminal: (id: string) => `pos-terminal-${id}`,
  sessions: 'pos-sessions',
  session: (id: string) => `pos-session-${id}`,
  transactions: 'pos-transactions',
  transaction: (id: string) => `pos-transaction-${id}`,
  promoCodes: 'pos-promo-codes',
  promoCode: (id: string) => `pos-promo-code-${id}`,
  giftCards: 'pos-gift-cards',
  loyalty: (customerId: string) => `pos-loyalty-${customerId}`,
  loyaltyProgram: 'pos-loyalty-program',
  cashDrawer: (sessionId: string) => `pos-cash-drawer-${sessionId}`,
  branchPricing: 'pos-branch-pricing',
  parkedSales: 'pos-parked-sales',
  posConfig: 'pos-config',
  receiptBranding: 'pos-receipt-branding',
  voidRequests: 'pos-void-requests',
  voidRequest: (txId: string) => `pos-void-requests-${txId}`,
  cancellationRequests: 'pos-cancellation-requests',
  cancellationRequest: (id: string) => `pos-cancellation-request-${id}`,
}

export async function getTerminals(): Promise<ApiResponse<PosTerminal[]>> {
  try {
    const result = await api.get<PosTerminal[]>('/pos/terminals')
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to fetch terminals' }
    }
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to fetch terminals' }
  }
}

export async function getTerminal(id: string): Promise<ApiResponse<PosTerminal>> {
  try {
    const result = await api.get<PosTerminal>(`/pos/terminals/${id}`, undefined, {
      tags: [TAGS.terminal(id)],
    })
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Terminal not found' }
    }
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to fetch terminal' }
  }
}

export async function createTerminal(
  input: CreateTerminalInput
): Promise<ApiResponse<PosTerminal>> {
  try {
    const result = await api.post<PosTerminal>('/pos/terminals', input)
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to create terminal' }
    }
    revalidateTag(TAGS.terminals, 'max')
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to create terminal' }
  }
}

export async function updateTerminal(
  id: string,
  input: UpdateTerminalInput
): Promise<ApiResponse<PosTerminal>> {
  try {
    const result = await api.patch<PosTerminal>(`/pos/terminals/${id}`, input)
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to update terminal' }
    }
    revalidateTag(TAGS.terminals, 'max')
    revalidateTag(TAGS.terminal(id), 'max')
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to update terminal' }
  }
}

export async function deleteTerminal(id: string): Promise<ApiResponse<void>> {
  try {
    const result = await api.delete(`/pos/terminals/${id}`)
    if (!result.success) {
      return { success: false, error: result.error || 'Failed to delete terminal' }
    }
    revalidateTag(TAGS.terminals, 'max')
    return { success: true }
  } catch {
    return { success: false, error: 'Failed to delete terminal' }
  }
}

export async function getSessions(filters?: {
  terminalId?: string
  cashierId?: string
  status?: string
  dateFrom?: string
  dateTo?: string
}): Promise<ApiResponse<PosSession[]>> {
  try {
    const result = await api.get<PosSession[]>('/pos/sessions', filters as Record<string, string>)
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to fetch sessions' }
    }
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to fetch sessions' }
  }
}

export async function getSession(id: string): Promise<ApiResponse<PosSession>> {
  try {
    const result = await api.get<PosSession>(`/pos/sessions/${id}`, undefined, {
      tags: [TAGS.session(id)],
    })
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Session not found' }
    }
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to fetch session' }
  }
}

export async function openSession(input: OpenSessionInput): Promise<ApiResponse<PosSession>> {
  try {
    const result = await api.post<PosSession>('/pos/sessions/open', input)
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to open session' }
    }
    revalidateTag(TAGS.sessions, 'max')
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to open session' }
  }
}

export async function closeSession(
  id: string,
  input: CloseSessionInput
): Promise<ApiResponse<PosSession>> {
  try {
    const result = await api.post<PosSession>(`/pos/sessions/${id}/close`, input)
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to close session' }
    }
    revalidateTag(TAGS.sessions, 'max')
    revalidateTag(TAGS.session(id), 'max')
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to close session' }
  }
}

export async function getSessionReconciliation(
  id: string
): Promise<ApiResponse<SessionReconciliation>> {
  try {
    const result = await api.get<SessionReconciliation>(`/pos/sessions/${id}/reconciliation`)
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to fetch reconciliation' }
    }
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to fetch reconciliation' }
  }
}

export async function getSalesSummary(filters?: {
  dateFrom?: string
  dateTo?: string
  branchId?: string
  cashierId?: string
  groupBy?: 'daily' | 'weekly'
}): Promise<ApiResponse<SalesSummary[]>> {
  try {
    const result = await api.get<SalesSummary[]>(
      '/pos/sessions/summary',
      filters as Record<string, string>
    )
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to fetch sales summary' }
    }
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to fetch sales summary' }
  }
}

export async function getTransactions(filters?: {
  sessionId?: string
  transactionType?: string
  customerId?: string
  transactionNumber?: string
  dateFrom?: string
  dateTo?: string
}): Promise<ApiResponse<PosTransaction[]>> {
  try {
    const result = await api.get<PosTransaction[]>(
      '/pos/transactions',
      filters as Record<string, string>
    )
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to fetch transactions' }
    }
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to fetch transactions' }
  }
}

export async function getTransaction(id: string): Promise<ApiResponse<PosTransaction>> {
  try {
    const result = await api.get<PosTransaction>(`/pos/transactions/${id}`, undefined, {
      tags: [TAGS.transaction(id)],
    })
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Transaction not found' }
    }
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to fetch transaction' }
  }
}

export async function createTransaction(
  input: CreateTransactionInput
): Promise<ApiResponse<PosTransaction>> {
  try {
    const result = await api.post<PosTransaction>('/pos/transactions', input)
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to create transaction' }
    }
    revalidateTag(TAGS.transactions, 'max')
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to create transaction' }
  }
}

export async function addPayment(
  transactionId: string,
  input: AddPaymentInput
): Promise<ApiResponse<PosTransaction>> {
  try {
    const result = await api.post<PosTransaction>(
      `/pos/transactions/${transactionId}/payments`,
      input
    )
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to add payment' }
    }
    revalidateTag(TAGS.transaction(transactionId), 'max')
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to add payment' }
  }
}

export async function voidTransaction(id: string): Promise<ApiResponse<PosTransaction>> {
  try {
    const result = await api.post<PosTransaction>(`/pos/transactions/${id}/void`)
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to void transaction' }
    }
    revalidateTag(TAGS.transactions, 'max')
    revalidateTag(TAGS.transaction(id), 'max')
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to void transaction' }
  }
}

export async function itemLookup(
  q?: string,
  branchId?: string,
  limit = 500
): Promise<ApiResponse<unknown[]>> {
  try {
    type CatalogItem = Record<string, unknown>
    type CatalogEnvelope =
      | CatalogItem[]
      | { data: CatalogItem[]; total?: number; page?: number; limit?: number }

    const params: Record<string, string> = {
      limit: String(limit),
      ...(q ? { search: q } : {}),
      ...(branchId ? { branchId } : {}),
    }

    const result = await api.get<CatalogEnvelope>('/pos/catalog', params)

    if (!result.success) return { success: false, error: result.error || 'Item lookup failed' }

    // Endpoint may return a bare array or a paginated { data: [...], total, page, limit } envelope
    const raw = result.data ?? []
    let rows: CatalogItem[] = Array.isArray(raw)
      ? raw
      : ((raw as { data?: CatalogItem[] }).data ?? [])

    // If paginated and there are more pages, fetch them all
    if (!Array.isArray(raw)) {
      const envelope = raw as { data?: CatalogItem[]; total?: number; limit?: number }
      const total = envelope.total ?? rows.length
      const pageSize = envelope.limit ?? limit
      if (total > pageSize) {
        const totalPages = Math.ceil(total / pageSize)
        const rest = await Promise.all(
          Array.from({ length: totalPages - 1 }, (_, i) =>
            api.get<CatalogEnvelope>('/pos/catalog', { ...params, page: String(i + 2) })
          )
        )
        for (const r of rest) {
          if (!r.success) continue
          const pageRaw = r.data
          const pageRows = Array.isArray(pageRaw)
            ? pageRaw
            : ((pageRaw as { data?: CatalogItem[] })?.data ?? [])
          rows = rows.concat(pageRows)
        }
      }
    }

    const DECIMAL_UOM_CODES = new Set([
      'kg',
      'g',
      'mg',
      'lb',
      'oz',
      'l',
      'ml',
      'liter',
      'litre',
      'liters',
      'litres',
      'gram',
      'grams',
      'kilogram',
      'kilograms',
      'milligram',
      'milligrams',
    ])

    const items = rows.map((item) => {
      const taxRateObj = item.taxRate as Record<string, unknown> | null | undefined
      const taxRate =
        taxRateObj != null && typeof taxRateObj === 'object'
          ? Number(taxRateObj.ratePercent ?? taxRateObj.rate) || null
          : item.taxRate != null
            ? Number(item.taxRate)
            : null

      // Try every field name the backend might use for the UOM
      const baseUnit = (item.baseUnit ?? item.unit ?? item.uom ?? item.unitOfMeasure) as
        | Record<string, unknown>
        | null
        | undefined
      const uomCode = (baseUnit?.code ??
        baseUnit?.name ??
        item.uomCode ??
        item.baseUnitCode ??
        item.unitCode ??
        item.uomName) as string | undefined
      const allowDecimal =
        baseUnit?.allowDecimal === true ||
        (baseUnit?.allowDecimal !== false &&
          !!uomCode &&
          DECIMAL_UOM_CODES.has(uomCode.toLowerCase()))

      return {
        id: item.id as string,
        name: item.name as string,
        sku: (item.sku as string | undefined) ?? '',
        barcode: (item.barcodes as { barcode: string }[] | undefined)?.[0]?.barcode ?? null,
        price: Number(item.price ?? item.sellingPrice ?? 0),
        stockQty: (item.stockQty ?? item.totalStockQuantity ?? item.stockQuantity) as
          | number
          | undefined,
        taxRateId: (item.taxRateId as string | null) ?? null,
        taxRate,
        baseUnitId: (item.baseUnitId as string | undefined) ?? undefined,
        uomCode,
        allowDecimal,
        isBundle: Boolean(item.isBundle),
        pricingMode: (item.pricingMode as 'inclusive' | 'exclusive' | undefined) ?? undefined,
        isSerialTracked: Boolean(item.isSerialTracked),
      }
    })

    return { success: true, data: items }
  } catch {
    return { success: false, error: 'Failed to look up items' }
  }
}

// ─── Accounting Tax Rate ──────────────────────────────────────────────────────

export async function getDefaultAccountingTaxRate(): Promise<{
  rate: number
  name: string
} | null> {
  try {
    const res =
      await api.get<
        Array<{ id: string; name: string; rate: number; isDefault: boolean; isActive: boolean }>
      >('/accounting/tax-rates')
    const rates = res.data ?? []
    const def = rates.find((r) => r.isDefault && r.isActive)
    return def ? { rate: def.rate, name: def.name } : null
  } catch {
    return null
  }
}

// ─── Promo Codes ──────────────────────────────────────────────────────────────

export async function getPromoCodes(): Promise<ApiResponse<PromoCode[]>> {
  try {
    const result = await api.get<PromoCode[]>('/pos/promo-codes', undefined, {
      tags: [TAGS.promoCodes],
    })
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to fetch promo codes' }
    }
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to fetch promo codes' }
  }
}

export async function createPromoCode(
  input: CreatePromoCodeInput
): Promise<ApiResponse<PromoCode>> {
  try {
    const result = await api.post<PromoCode>('/pos/promo-codes', input)
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to create promo code' }
    }
    revalidateTag(TAGS.promoCodes, 'max')
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to create promo code' }
  }
}

export async function updatePromoCode(
  id: string,
  input: UpdatePromoCodeInput
): Promise<ApiResponse<PromoCode>> {
  try {
    const result = await api.patch<PromoCode>(`/pos/promo-codes/${id}`, input)
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to update promo code' }
    }
    revalidateTag(TAGS.promoCodes, 'max')
    revalidateTag(TAGS.promoCode(id), 'max')
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to update promo code' }
  }
}

export async function deletePromoCode(id: string): Promise<ApiResponse<void>> {
  try {
    const result = await api.delete(`/pos/promo-codes/${id}`)
    if (!result.success) {
      return { success: false, error: result.error || 'Failed to delete promo code' }
    }
    revalidateTag(TAGS.promoCodes, 'max')
    return { success: true }
  } catch {
    return { success: false, error: 'Failed to delete promo code' }
  }
}

export async function validatePromoCode(
  input: ValidatePromoCodeInput
): Promise<ApiResponse<PromoValidationResult>> {
  try {
    const result = await api.post<PromoValidationResult>('/pos/promo-codes/validate', input)
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to validate promo code' }
    }
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to validate promo code' }
  }
}

// â”€â”€â”€ Gift Cards â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function getGiftCards(): Promise<ApiResponse<GiftCard[]>> {
  try {
    const result = await api.get<GiftCard[]>('/pos/gift-cards', undefined, {
      tags: [TAGS.giftCards],
    })
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to fetch gift cards' }
    }
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to fetch gift cards' }
  }
}

export async function issueGiftCard(input: IssueGiftCardInput): Promise<ApiResponse<GiftCard>> {
  try {
    const result = await api.post<GiftCard>('/pos/gift-cards', input)
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to issue gift card' }
    }
    revalidateTag(TAGS.giftCards, 'max')
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to issue gift card' }
  }
}

export async function checkGiftCardBalance(cardNumber: string): Promise<ApiResponse<GiftCard>> {
  try {
    const result = await api.get<GiftCard>(`/pos/gift-cards/check/${cardNumber}`)
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Gift card not found' }
    }
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to check gift card balance' }
  }
}

export async function voidGiftCard(id: string, reason?: string): Promise<ApiResponse<GiftCard>> {
  try {
    const result = await api.post<GiftCard>(
      `/pos/gift-cards/${id}/void`,
      reason ? { reason } : undefined
    )
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to void gift card' }
    }
    revalidateTag(TAGS.giftCards, 'max')
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to void gift card' }
  }
}

export async function getGiftCardHistory(id: string): Promise<ApiResponse<GiftCardHistoryEntry[]>> {
  try {
    const result = await api.get<GiftCardHistoryEntry[]>(`/pos/gift-cards/${id}/history`)
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to fetch gift card history' }
    }
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to fetch gift card history' }
  }
}

export async function getSessionDisplay(id: string): Promise<ApiResponse<SessionDisplay>> {
  try {
    const result = await api.get<SessionDisplay>(`/pos/sessions/${id}/display`)
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to fetch session display' }
    }
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to fetch session display' }
  }
}

export async function updateSessionDisplay(
  id: string,
  body: {
    status: 'idle' | 'active'
    lines: { itemName: string; quantity: number; unitPrice: number; lineTotal: number }[]
    subtotal: number
    discountTotal: number
    taxTotal: number
    totalAmount: number
    currency: string
  }
): Promise<ApiResponse<SessionDisplay>> {
  try {
    const result = await api.post<SessionDisplay>(`/pos/sessions/${id}/display`, body)
    if (!result.success)
      return { success: false, error: result.error ?? 'Failed to update display' }
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to update session display' }
  }
}

// â”€â”€â”€ Loyalty â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function getLoyaltyByCustomer(
  customerId: string
): Promise<ApiResponse<LoyaltyAccount>> {
  try {
    const result = await api.get<LoyaltyAccount>(
      `/pos/loyalty-accounts/customer/${customerId}`,
      undefined,
      { tags: [TAGS.loyalty(customerId)] }
    )
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Loyalty account not found' }
    }
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to fetch loyalty account' }
  }
}

export async function getLoyaltyHistory(
  accountId: string
): Promise<ApiResponse<LoyaltyTransaction[]>> {
  try {
    const result = await api.get<LoyaltyTransaction[]>(`/pos/loyalty-accounts/${accountId}/history`)
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to fetch loyalty history' }
    }
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to fetch loyalty history' }
  }
}

export async function earnPoints(
  accountId: string,
  input: EarnPointsInput
): Promise<ApiResponse<LoyaltyAccount>> {
  try {
    const result = await api.post<LoyaltyAccount>(`/pos/loyalty-accounts/${accountId}/earn`, input)
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to earn points' }
    }
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to earn points' }
  }
}

export async function redeemPoints(
  accountId: string,
  input: RedeemPointsInput
): Promise<ApiResponse<LoyaltyAccount>> {
  try {
    const result = await api.post<LoyaltyAccount>(
      `/pos/loyalty-accounts/${accountId}/redeem`,
      input
    )
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to redeem points' }
    }
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to redeem points' }
  }
}

// â”€â”€â”€ Cash Drawer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function getCashDrawerEvents(
  sessionId: string
): Promise<ApiResponse<CashDrawerEvent[]>> {
  try {
    const result = await api.get<CashDrawerEvent[]>(
      '/pos/cash-drawer-events',
      { sessionId },
      { tags: [TAGS.cashDrawer(sessionId)] }
    )
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to fetch cash drawer events' }
    }
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to fetch cash drawer events' }
  }
}

export async function createCashDrawerEvent(
  input: CreateCashDrawerEventInput
): Promise<ApiResponse<CashDrawerEvent>> {
  try {
    const result = await api.post<CashDrawerEvent>('/pos/cash-drawer-events', input)
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to create cash drawer event' }
    }
    revalidateTag(TAGS.cashDrawer(input.sessionId), 'max')
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to create cash drawer event' }
  }
}

// â”€â”€â”€ Branch Pricing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function getBranchPricing(
  branchId?: string,
  itemId?: string
): Promise<ApiResponse<BranchPricing[]>> {
  try {
    const result = await api.get<BranchPricing[]>(
      '/pos/branch-pricing',
      { branchId, itemId } as Record<string, string>,
      { tags: [TAGS.branchPricing] }
    )
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to fetch branch pricing' }
    }
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to fetch branch pricing' }
  }
}

export async function createBranchPricing(
  input: CreateBranchPricingInput
): Promise<ApiResponse<BranchPricing>> {
  try {
    const result = await api.post<BranchPricing>('/pos/branch-pricing', input)
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to create branch pricing' }
    }
    revalidateTag(TAGS.branchPricing, 'max')
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to create branch pricing' }
  }
}

export async function updateBranchPricing(
  id: string,
  input: UpdateBranchPricingInput
): Promise<ApiResponse<BranchPricing>> {
  try {
    const result = await api.patch<BranchPricing>(`/pos/branch-pricing/${id}`, input)
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to update branch pricing' }
    }
    revalidateTag(TAGS.branchPricing, 'max')
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to update branch pricing' }
  }
}

export async function deleteBranchPricing(id: string): Promise<ApiResponse<void>> {
  try {
    const result = await api.delete(`/pos/branch-pricing/${id}`)
    if (!result.success) {
      return { success: false, error: result.error || 'Failed to delete branch pricing' }
    }
    revalidateTag(TAGS.branchPricing, 'max')
    return { success: true }
  } catch {
    return { success: false, error: 'Failed to delete branch pricing' }
  }
}

// â”€â”€â”€ Parked Sales â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function getParkedSales(terminalId?: string): Promise<ApiResponse<ParkedSale[]>> {
  try {
    const result = await api.get<ParkedSale[]>(
      '/pos/parked-sales',
      terminalId ? { terminalId } : undefined,
      { tags: [TAGS.parkedSales] }
    )
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to fetch parked sales' }
    }
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to fetch parked sales' }
  }
}

export async function parkSale(input: ParkSaleInput): Promise<ApiResponse<ParkedSale>> {
  try {
    const result = await api.post<ParkedSale>('/pos/parked-sales', input)
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to park sale' }
    }
    revalidateTag(TAGS.parkedSales, 'max')
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to park sale' }
  }
}

export async function resumeParkedSale(id: string): Promise<ApiResponse<ParkedSale>> {
  try {
    const result = await api.post<ParkedSale>(`/pos/parked-sales/${id}/resume`)
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to resume parked sale' }
    }
    revalidateTag(TAGS.parkedSales, 'max')
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to resume parked sale' }
  }
}

export async function handoverSession(
  id: string,
  input: HandoverSessionInput
): Promise<ApiResponse<HandoverSessionResult>> {
  try {
    const result = await api.post<HandoverSessionResult>(`/pos/sessions/${id}/handover`, input)
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to handover session' }
    }
    revalidateTag(TAGS.sessions, 'max')
    revalidateTag(TAGS.session(id), 'max')
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to handover session' }
  }
}

export async function sendReceipt(
  transactionId: string,
  input: SendReceiptInput
): Promise<ApiResponse<SendReceiptResult>> {
  try {
    const result = await api.post<SendReceiptResult>(
      `/pos/transactions/${transactionId}/send-receipt`,
      input
    )
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to send receipt' }
    }
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to send receipt' }
  }
}

export async function getReceipt(transactionId: string): Promise<ApiResponse<PosTransaction>> {
  try {
    const result = await api.get<PosTransaction>(`/pos/transactions/${transactionId}/receipt`)
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to fetch receipt' }
    }
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to fetch receipt' }
  }
}

export async function logReprintEvent(transactionId: string): Promise<ApiResponse<void>> {
  try {
    await api.post(`/pos/transactions/${transactionId}/reprint`, {})
    return { success: true }
  } catch {
    return { success: true } // never block the reprint on a logging failure
  }
}

export async function getActiveLoyaltyProgram(): Promise<ApiResponse<LoyaltyProgram>> {
  try {
    const result = await api.get<LoyaltyProgram>('/pos/loyalty-program/active', undefined, {
      tags: [TAGS.loyaltyProgram],
    })
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'No active loyalty program' }
    }
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to fetch loyalty program' }
  }
}

export async function getCrossBranchStock(
  itemId: string
): Promise<ApiResponse<CrossBranchStockResult>> {
  try {
    const result = await api.get<CrossBranchStockResult>(
      `/pos/transactions/items/cross-branch-stock/${itemId}`
    )
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to fetch cross-branch stock' }
    }
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to fetch cross-branch stock' }
  }
}

export async function getCustomerTransactions(
  customerId: string
): Promise<ApiResponse<PosTransaction[]>> {
  try {
    const result = await api.get<PosTransaction[]>(`/pos/transactions/customer/${customerId}`)
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to fetch customer transactions' }
    }
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to fetch customer transactions' }
  }
}

export async function syncTransactions(
  input: SyncTransactionsInput
): Promise<ApiResponse<SyncTransactionsResult>> {
  try {
    const result = await api.post<SyncTransactionsResult>('/pos/transactions/sync', input)
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to sync transactions' }
    }
    revalidateTag(TAGS.transactions, 'max')
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to sync transactions' }
  }
}

export async function createLoyaltyAccount(
  input: CreateLoyaltyAccountInput
): Promise<ApiResponse<LoyaltyAccount>> {
  try {
    const result = await api.post<LoyaltyAccount>('/pos/loyalty-accounts', input)
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to create loyalty account' }
    }
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to create loyalty account' }
  }
}

export async function getBranchPricingByItem(
  itemId: string,
  branchId?: string
): Promise<ApiResponse<BranchPricing[]>> {
  try {
    const result = await api.get<BranchPricing[]>(
      `/pos/branch-pricing/item/${itemId}`,
      branchId ? { branchId } : undefined,
      { tags: [TAGS.branchPricing] }
    )
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to fetch branch pricing for item' }
    }
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to fetch branch pricing for item' }
  }
}

export async function cancelParkedSale(id: string): Promise<ApiResponse<ParkedSale>> {
  try {
    const result = await api.post<ParkedSale>(`/pos/parked-sales/${id}/cancel`)
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to cancel parked sale' }
    }
    revalidateTag(TAGS.parkedSales, 'max')
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to cancel parked sale' }
  }
}

// â”€â”€â”€ Branches â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface Branch {
  id: string
  name: string
}

export async function getBranches(): Promise<ApiResponse<Branch[]>> {
  try {
    const result = await api.get<{ data: Branch[] } | Branch[]>(
      '/branches',
      { limit: '200' },
      {
        tags: ['branches'],
      }
    )
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to fetch branches' }
    }
    const branches = Array.isArray(result.data) ? result.data : result.data.data
    return { success: true, data: branches }
  } catch {
    return { success: false, error: 'Failed to fetch branches' }
  }
}

// â”€â”€â”€ Customers (CRM bridge) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function searchCustomers(q: string): Promise<ApiResponse<PosCustomer[]>> {
  try {
    const result = await api.get<PosCustomer[] | { data: PosCustomer[] }>('/crm/customers', {
      search: q,
      limit: '10',
    } as Record<string, string>)
    if (!result.success) return { success: false, error: result.error || 'Search failed' }
    const raw = result.data ?? []
    const rows: PosCustomer[] = Array.isArray(raw)
      ? raw
      : ((raw as { data: PosCustomer[] }).data ?? [])
    return { success: true, data: rows }
  } catch {
    return { success: false, error: 'Failed to search customers' }
  }
}

export async function getCustomerById(id: string): Promise<ApiResponse<PosCustomer>> {
  try {
    const result = await api.get<PosCustomer>(`/crm/customers/${id}`)
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Not found' }
    }
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to fetch customer' }
  }
}

export async function createWalkInCustomer(
  input: CreateWalkInCustomerInput
): Promise<ApiResponse<PosCustomer>> {
  try {
    const result = await api.post<PosCustomer>('/pos/customers', input)
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to create customer' }
    }
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to create customer' }
  }
}

// â”€â”€â”€ Loyalty Program â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function getLoyaltyProgram(tenantId: string): Promise<ApiResponse<LoyaltyProgram>> {
  try {
    const result = await api.get<LoyaltyProgram>(
      `/pos/loyalty-program/tenant/${tenantId}`,
      undefined,
      { tags: [TAGS.loyaltyProgram] }
    )
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Loyalty program not found' }
    }
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to fetch loyalty program' }
  }
}

export async function createLoyaltyProgram(
  input: CreateLoyaltyProgramInput
): Promise<ApiResponse<LoyaltyProgram>> {
  try {
    const result = await api.post<LoyaltyProgram>('/pos/loyalty-program', input)
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to create loyalty program' }
    }
    revalidateTag(TAGS.loyaltyProgram, 'max')
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to create loyalty program' }
  }
}

export async function updateLoyaltyProgram(
  id: string,
  input: UpdateLoyaltyProgramInput
): Promise<ApiResponse<LoyaltyProgram>> {
  try {
    const result = await api.patch<LoyaltyProgram>(`/pos/loyalty-program/${id}`, input)
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to update loyalty program' }
    }
    revalidateTag(TAGS.loyaltyProgram, 'max')
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to update loyalty program' }
  }
}

export async function getPosConfig(tenantId: string): Promise<ApiResponse<PosConfig>> {
  try {
    const result = await api.get<PosConfig>(`/pos/config/tenant/${tenantId}`, undefined, {
      tags: [TAGS.posConfig],
    })
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'POS config not found' }
    }
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to fetch POS config' }
  }
}

export async function createPosConfig(
  input: CreatePosConfigInput
): Promise<ApiResponse<PosConfig>> {
  try {
    const result = await api.post<PosConfig>('/pos/config', input)
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to create POS config' }
    }
    revalidateTag(TAGS.posConfig, 'max')
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to create POS config' }
  }
}

/** Upsert: updates existing config if it exists, creates one with defaults if not. */
export async function upsertPosConfig(
  input: UpdatePosConfigInput & { existingId?: string }
): Promise<ApiResponse<PosConfig>> {
  try {
    const { existingId, ...fields } = input
    console.log('[upsertPosConfig] existingId:', existingId, '| fields:', JSON.stringify(fields))

    if (existingId) {
      const result = await api.patch<PosConfig>(`/pos/config/${existingId}`, fields)
      console.log('[upsertPosConfig] PATCH result:', JSON.stringify(result))
      if (!result.success || !result.data) {
        return { success: false, error: result.error || 'Failed to update POS config' }
      }
      revalidateTag(TAGS.posConfig, 'max')
      return { success: true, data: result.data }
    }

    // No existing config — create one. Backend reads tenantId from the JWT.
    const createResult = await api.post<PosConfig>('/pos/config', {
      discountOverrideThreshold: fields.discountOverrideThreshold ?? 20,
      receiptlessReturnDays: fields.receiptlessReturnDays ?? 7,
      allowNegativeStock: fields.allowNegativeStock ?? false,
    })
    console.log('[upsertPosConfig] POST create result:', JSON.stringify(createResult))
    if (!createResult.success || !createResult.data) {
      return { success: false, error: createResult.error || 'Failed to create POS config' }
    }
    // The backend only accepts orderQueueCategoryId via PATCH, not POST.
    // If one was provided, follow up with a PATCH on the newly-created config.
    if (fields.orderQueueCategoryId !== undefined && fields.orderQueueCategoryId !== null) {
      const patchResult = await api.patch<PosConfig>(`/pos/config/${createResult.data.id}`, {
        orderQueueCategoryId: fields.orderQueueCategoryId,
      })
      console.log(
        '[upsertPosConfig] PATCH orderQueueCategoryId result:',
        JSON.stringify(patchResult)
      )
      if (patchResult.success && patchResult.data) {
        revalidateTag(TAGS.posConfig, 'max')
        return { success: true, data: patchResult.data }
      }
    }
    revalidateTag(TAGS.posConfig, 'max')
    return { success: true, data: createResult.data }
  } catch (e) {
    console.error('[upsertPosConfig] threw:', e)
    return { success: false, error: 'Failed to save POS config' }
  }
}

export async function updatePosConfig(
  id: string,
  input: UpdatePosConfigInput
): Promise<ApiResponse<PosConfig>> {
  try {
    const result = await api.patch<PosConfig>(`/pos/config/${id}`, input)
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to update POS config' }
    }
    revalidateTag(TAGS.posConfig, 'max')
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to update POS config' }
  }
}

export async function getActivePosConfig(): Promise<ApiResponse<PosConfig | null>> {
  try {
    const result = await api.get<PosConfig | null>('/pos/config/active', undefined, {
      tags: [TAGS.posConfig],
    })
    console.log('[getActivePosConfig] /active result:', JSON.stringify(result))
    if (result.success && result.data) {
      return { success: true, data: result.data }
    }

    // /pos/config/active returned nothing — fall back to tenant lookup
    const session = await getSessionOrNull()
    if (!session) return { success: true, data: null }

    const tenantId = session.enterpriseOwnerId ?? session.id
    console.log('[getActivePosConfig] falling back to /tenant/', tenantId)
    const tenantResult = await api.get<PosConfig>(`/pos/config/tenant/${tenantId}`, undefined, {
      tags: [TAGS.posConfig],
    })
    console.log('[getActivePosConfig] /tenant result:', JSON.stringify(tenantResult))
    return { success: true, data: tenantResult.data ?? null }
  } catch (e) {
    console.error('[getActivePosConfig] threw:', e)
    return { success: true, data: null }
  }
}

// ─── Order Queue ─────────────────────────────────────────────────────────────

export interface AddToQueueResult {
  ticket: { id: string; number: number }
  categoryId: string
  categoryName: string
  transactionId: string
  transactionNumber: string
  items: {
    itemId: string
    name: string
    sku: string
    quantity: number
    unitPrice: number
    discountAmount: number
    lineTotal: number
  }[]
}

export async function addToOrderQueue(
  transactionId: string,
  input: { categoryId?: string; customerName?: string; notes?: string }
): Promise<ApiResponse<AddToQueueResult>> {
  try {
    const result = await api.post<AddToQueueResult>(
      `/pos/transactions/${transactionId}/add-to-queue`,
      input
    )
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to add to order queue' }
    }
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to add to order queue' }
  }
}

// ─── Cashier PIN ──────────────────────────────────────────────────────────────

export async function getCashierPinStatus(): Promise<ApiResponse<{ hasPin: boolean }>> {
  try {
    const result = await api.get<{ hasPin: boolean }>('/pos/cashier/pin/status')
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to fetch PIN status' }
    }
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to fetch PIN status' }
  }
}

export async function registerCashierPin(pin: string): Promise<ApiResponse<void>> {
  try {
    const result = await api.post('/pos/cashier/pin/register', { pin })
    if (!result.success) {
      return { success: false, error: result.error || 'Failed to set PIN' }
    }
    return { success: true, data: undefined }
  } catch {
    return { success: false, error: 'Failed to set PIN' }
  }
}

export async function changeCashierPin(
  currentPin: string,
  newPin: string
): Promise<ApiResponse<void>> {
  try {
    const result = await api.post('/pos/cashier/pin/change', { currentPin, newPin })
    if (!result.success) {
      return { success: false, error: result.error || 'Failed to change PIN' }
    }
    return { success: true, data: undefined }
  } catch {
    return { success: false, error: 'Failed to change PIN' }
  }
}

export async function getUsers(): Promise<
  ApiResponse<{ id: string; name: string; email: string }[]>
> {
  try {
    type UserRow = { id: string; name: string; email: string }
    const result = await api.get<UserRow[] | { data: UserRow[] }>('/users')
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to fetch users' }
    }
    const users = Array.isArray(result.data)
      ? result.data
      : ((result.data as { data: UserRow[] }).data ?? [])
    return { success: true, data: users }
  } catch {
    return { success: false, error: 'Failed to fetch users' }
  }
}

export async function verifyCashierPin(
  userId: string,
  pin: string
): Promise<ApiResponse<{ id: string; name: string; email: string }>> {
  try {
    const result = await api.post<{ id: string; name: string; email: string }>(
      '/pos/cashier/pin/login',
      { userId, pin }
    )
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Invalid PIN or user ID' }
    }
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to verify cashier PIN' }
  }
}

export async function validateManagerOverride(
  managerId: string,
  pin: string
): Promise<ApiResponse<{ valid: boolean; managerId: string; managerName: string }>> {
  try {
    const result = await api.post<{ valid: boolean; managerId: string; managerName: string }>(
      '/pos/cashier/manager-override/validate-pin',
      { managerId, pin }
    )
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Manager override failed' }
    }
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to validate manager override' }
  }
}

export async function validateManagerByPin(
  pin: string
): Promise<ApiResponse<{ valid: boolean; managerId: string; managerName: string }>> {
  try {
    const result = await api.post<{ valid: boolean; managerId: string; managerName: string }>(
      '/pos/cashier/manager-override/validate-pin-only',
      { pin }
    )
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Invalid PIN' }
    }
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to validate PIN' }
  }
}

// ─── Cashier Terminal Access ──────────────────────────────────────────────────

export async function getTerminalCashiers(
  terminalId: string
): Promise<ApiResponse<CashierTerminalAccess[]>> {
  try {
    const result = await api.get<CashierTerminalAccess[]>(`/pos/terminals/${terminalId}/cashiers`)
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to fetch cashiers' }
    }
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to fetch cashiers' }
  }
}

export async function assignCashierToTerminal(
  terminalId: string,
  userId: string
): Promise<ApiResponse<CashierTerminalAccess>> {
  try {
    const result = await api.post<CashierTerminalAccess>(`/pos/terminals/${terminalId}/cashiers`, {
      userId,
    })
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to assign cashier' }
    }
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to assign cashier' }
  }
}

export async function removeCashierFromTerminal(
  terminalId: string,
  userId: string
): Promise<ApiResponse<void>> {
  try {
    const result = await api.delete(`/pos/terminals/${terminalId}/cashiers/${userId}`)
    if (!result.success) {
      return { success: false, error: result.error || 'Failed to remove cashier' }
    }
    return { success: true }
  } catch {
    return { success: false, error: 'Failed to remove cashier' }
  }
}

// ─── Payment Methods ──────────────────────────────────────────────────────────

export async function getPaymentMethods(): Promise<
  ApiResponse<{ data: PaymentMethodConfig[]; meta: { total: number } }>
> {
  try {
    const result = await api.get<{ data: PaymentMethodConfig[]; meta: { total: number } }>(
      '/pos/payment-method-configs',
      undefined,
      { tags: ['pos-payment-methods'] }
    )
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to fetch payment methods' }
    }
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to fetch payment methods' }
  }
}

export async function updatePaymentMethod(
  id: string,
  input: Partial<{ isEnabled: boolean; name: string; glAccountId: string | null }>
): Promise<ApiResponse<PaymentMethodConfig>> {
  try {
    const result = await api.patch<PaymentMethodConfig>(`/pos/payment-method-configs/${id}`, input)
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to update payment method' }
    }
    revalidateTag('pos-payment-methods', 'max')
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to update payment method' }
  }
}

export async function createCustomPaymentMethod(
  input: CreateCustomPaymentMethodInput
): Promise<ApiResponse<PaymentMethodConfig>> {
  try {
    const result = await api.post<PaymentMethodConfig>('/pos/payment-method-configs/custom', input)
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to create payment method' }
    }
    revalidateTag('pos-payment-methods', 'max')
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to create payment method' }
  }
}

export async function deletePaymentMethod(id: string): Promise<ApiResponse<void>> {
  try {
    const result = await api.delete(`/pos/payment-method-configs/${id}`)
    if (!result.success) {
      return { success: false, error: result.error || 'Failed to delete payment method' }
    }
    revalidateTag('pos-payment-methods', 'max')
    return { success: true }
  } catch {
    return { success: false, error: 'Failed to delete payment method' }
  }
}

export async function reorderPaymentMethods(orderedIds: string[]): Promise<ApiResponse<void>> {
  try {
    const result = await api.patch('/pos/payment-method-configs/reorder', { orderedIds })
    if (!result.success) {
      return { success: false, error: result.error || 'Failed to save order' }
    }
    revalidateTag('pos-payment-methods', 'max')
    return { success: true }
  } catch {
    return { success: false, error: 'Failed to save order' }
  }
}

// ─── Account Mapping ──────────────────────────────────────────────────────────

export interface AccountMapping {
  id: string
  key: string
  label: string
  description: string | null
  accountId: string | null
}

export interface GLAccount {
  id: string
  code: string
  number?: string
  name: string
  accountType: string
}

export async function getAccountMappings(): Promise<ApiResponse<AccountMapping[]>> {
  try {
    const result = await api.get<AccountMapping[]>('/account-mapping', undefined, {
      tags: ['account-mappings'],
    })
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to fetch account mappings' }
    }
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to fetch account mappings' }
  }
}

export async function bulkUpdateAccountMappings(
  mappings: { key: string; accountId: string | null }[]
): Promise<ApiResponse<void>> {
  try {
    const result = await api.post('/account-mapping/bulk', { mappings })
    if (!result.success) {
      return { success: false, error: result.error || 'Failed to save account mappings' }
    }
    revalidateTag('account-mappings', 'max')
    return { success: true, data: undefined }
  } catch {
    return { success: false, error: 'Failed to save account mappings' }
  }
}

export async function getGLAccounts(): Promise<ApiResponse<GLAccount[]>> {
  try {
    const result = await api.get<GLAccount[]>('/accounts', undefined, {
      tags: ['gl-accounts'],
    })
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to fetch accounts' }
    }
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to fetch accounts' }
  }
}

export async function getEnabledBranchPaymentMethods(
  branchId: string
): Promise<ApiResponse<PosPaymentMethod[]>> {
  try {
    const result = await api.get<{ data: BranchPaymentMethod[] }>(
      `/pos/branches/${branchId}/payment-methods`
    )
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to fetch payment methods' }
    }
    const enabled = result.data.data.filter((m) => m.isEnabled).map((m) => m.method)
    return { success: true, data: enabled }
  } catch {
    return { success: false, error: 'Failed to fetch payment methods' }
  }
}

// ─── Receipt Branding ────────────────────────────────────────────────────────

export interface ReceiptBranding {
  receiptLogoUrl: string | null
  receiptHeaderText: string | null
}

export async function getReceiptBranding(): Promise<ApiResponse<ReceiptBranding>> {
  try {
    const result = await api.get<{ data: ReceiptBranding }>(
      '/pos/receipt-config/branding',
      undefined,
      { tags: [TAGS.receiptBranding] }
    )
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to fetch branding' }
    }
    return { success: true, data: result.data.data }
  } catch {
    return { success: false, error: 'Failed to fetch branding' }
  }
}

export async function uploadReceiptLogo(
  formData: FormData
): Promise<ApiResponse<{ logoUrl: string }>> {
  try {
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    const authToken = cookieStore.get('authToken')?.value
    const apiBase = (process.env.API_URL || 'http://localhost:3001').replace(/\/$/, '')

    const response = await fetch(`${apiBase}/pos/receipt-config/branding/logo`, {
      method: 'POST',
      headers: { ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
      body: formData,
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      return {
        success: false,
        error: err.errorCode ?? err.message ?? `Upload failed (${response.status})`,
      }
    }

    const json = await response.json()
    revalidateTag(TAGS.receiptBranding, 'max')
    return { success: true, data: json.data }
  } catch {
    return { success: false, error: 'Upload failed' }
  }
}

export async function updateReceiptBranding(input: {
  logoUrl?: string | null
  headerText?: string
}): Promise<ApiResponse<ReceiptBranding>> {
  try {
    const result = await api.patch<{ data: ReceiptBranding }>('/pos/receipt-config/branding', input)
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to update branding' }
    }
    revalidateTag(TAGS.receiptBranding, 'max')
    return { success: true, data: result.data.data }
  } catch {
    return { success: false, error: 'Failed to update branding' }
  }
}

// ─── Void Requests ────────────────────────────────────────────────────────────

export async function submitVoidRequest(
  transactionId: string,
  input: SubmitVoidRequestInput
): Promise<ApiResponse<PosVoidRequest>> {
  try {
    const result = await api.post<PosVoidRequest>(
      `/pos/transactions/${transactionId}/void-request`,
      input
    )
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to submit void request' }
    }
    revalidateTag(TAGS.voidRequest(transactionId), 'max')
    revalidateTag(TAGS.voidRequests, 'max')
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to submit void request' }
  }
}

export async function getVoidRequests(
  transactionId: string
): Promise<ApiResponse<PosVoidRequest[]>> {
  try {
    const result = await api.get<PosVoidRequest[]>(
      `/pos/transactions/${transactionId}/void-requests`,
      undefined,
      { tags: [TAGS.voidRequest(transactionId)] }
    )
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to fetch void requests' }
    }
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to fetch void requests' }
  }
}

export async function getVoidRequestHistory(): Promise<ApiResponse<PosVoidRequest[]>> {
  try {
    const result = await api.get<PosVoidRequest[]>('/pos/transactions/void-requests/history')
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to load void request history' }
    }
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to load void request history' }
  }
}

export async function getBranchVoidRequests(): Promise<ApiResponse<PosVoidRequest[]>> {
  try {
    const result = await api.get<PosVoidRequest[]>(
      '/pos/transactions/void-requests/branch',
      undefined,
      { tags: [TAGS.voidRequests] }
    )
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to fetch void requests' }
    }
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to fetch void requests' }
  }
}

export async function getPendingVoidRequests(): Promise<ApiResponse<PosVoidRequest[]>> {
  try {
    const result = await api.get<PosVoidRequest[]>(
      '/pos/transactions/void-requests/pending',
      undefined,
      { tags: [TAGS.voidRequests] }
    )
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to fetch pending void requests' }
    }
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to fetch pending void requests' }
  }
}

export interface SerialNumberRecord {
  id: string
  serialNumber: string
  currentWarehouseId?: string | null
}

export async function getAvailableSerialNumbers(
  itemId: string
): Promise<ApiResponse<SerialNumberRecord[]>> {
  try {
    type Envelope = SerialNumberRecord[] | { data: SerialNumberRecord[] }
    const result = await api.get<Envelope>(
      `/inventory/serial-numbers?itemId=${itemId}&status=in_stock`
    )
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to fetch serial numbers' }
    }
    const rows = Array.isArray(result.data)
      ? result.data
      : ((result.data as { data: SerialNumberRecord[] }).data ?? [])
    return { success: true, data: rows }
  } catch {
    return { success: false, error: 'Failed to fetch serial numbers' }
  }
}

export async function approveVoidRequest(
  requestId: string,
  input: ReviewVoidRequestInput
): Promise<ApiResponse<PosVoidRequest>> {
  try {
    const result = await api.post<PosVoidRequest>(
      `/pos/transactions/void-requests/${requestId}/approve`,
      input
    )
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to approve void request' }
    }
    revalidateTag(TAGS.voidRequests, 'max')
    revalidateTag(TAGS.transactions, 'max')
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to approve void request' }
  }
}

export async function rejectVoidRequest(
  requestId: string,
  input: ReviewVoidRequestInput
): Promise<ApiResponse<PosVoidRequest>> {
  try {
    const result = await api.post<PosVoidRequest>(
      `/pos/transactions/void-requests/${requestId}/reject`,
      input
    )
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to reject void request' }
    }
    revalidateTag(TAGS.voidRequests, 'max')
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to reject void request' }
  }
}

// ─── Cancellation Requests ────────────────────────────────────────────────────

export async function submitCancellationRequest(
  sessionId: string,
  input: SubmitCancellationInput
): Promise<ApiResponse<PosCancellationRequest>> {
  try {
    const result = await api.post<PosCancellationRequest>(
      `/pos/sessions/${sessionId}/cancellation-requests`,
      input
    )
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to submit cancellation request' }
    }
    revalidateTag(TAGS.cancellationRequests, 'max')
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to submit cancellation request' }
  }
}

export async function getPendingCancellationRequests(): Promise<
  ApiResponse<PosCancellationRequest[]>
> {
  try {
    const result = await api.get<PosCancellationRequest[]>(
      '/pos/cancellation-requests/pending',
      undefined,
      { tags: [TAGS.cancellationRequests] }
    )
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to fetch cancellation requests' }
    }
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to fetch cancellation requests' }
  }
}

export async function getCancellationRequestStatus(
  requestId: string
): Promise<ApiResponse<PosCancellationRequest>> {
  try {
    const result = await api.get<PosCancellationRequest>(
      `/pos/cancellation-requests/${requestId}/status`,
      undefined,
      { tags: [TAGS.cancellationRequest(requestId)] }
    )
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to fetch status' }
    }
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to fetch status' }
  }
}

export async function approveCancellationRequest(
  requestId: string,
  input: ReviewCancellationInput
): Promise<ApiResponse<PosCancellationRequest>> {
  try {
    const result = await api.post<PosCancellationRequest>(
      `/pos/cancellation-requests/${requestId}/approve`,
      input
    )
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to approve cancellation request' }
    }
    revalidateTag(TAGS.cancellationRequests, 'max')
    revalidateTag(TAGS.cancellationRequest(requestId), 'max')
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to approve cancellation request' }
  }
}

export async function rejectCancellationRequest(
  requestId: string,
  input: ReviewCancellationInput
): Promise<ApiResponse<PosCancellationRequest>> {
  try {
    const result = await api.post<PosCancellationRequest>(
      `/pos/cancellation-requests/${requestId}/reject`,
      input
    )
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to reject cancellation request' }
    }
    revalidateTag(TAGS.cancellationRequests, 'max')
    revalidateTag(TAGS.cancellationRequest(requestId), 'max')
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to reject cancellation request' }
  }
}
