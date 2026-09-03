'use client'

import { Fragment, useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  Search,
  Plus,
  Minus,
  X,
  Tag,
  ShoppingCart,
  AlertTriangle,
  CheckCircle2,
  Receipt,
  User,
  UserPlus,
  PauseCircle,
  XCircle,
  ShieldCheck,
  Loader2,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  KeyRound,
  WifiOff,
  UtensilsCrossed,
  Send,
  Clock,
  Building2,
  LayoutGrid,
  List,
  Printer,
  FileSignature,
  Trash2,
  Paperclip,
} from 'lucide-react'
import PhoneInput from 'react-phone-number-input'
import 'react-phone-number-input/style.css'
import {
  computePricingTotals,
  resolveLineTaxRate,
  displayUnitPriceWithTax,
  lineTaxAmount,
} from './_utils/calculations'
import { useRouter } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { POS_PERMISSIONS } from '@/src/libs/guards/pos-permissions'
import { useSessions } from '../_hooks/usePos'
import { usePosBranchContext } from '@/src/stores/pos-branch-context.store'
import { Skeleton } from '@/src/components/ui/Skeleton'
import CustomerExtraFields, {
  type CustomerExtraFieldsValues,
} from '@/src/components/crm/CustomerExtraFields'
import { ID_TYPE_OPTIONS, type CoMakerFormValues } from '@/src/schema/crm/customer'
import type { DuplicateCheckResult } from '@/src/schema/crm/types'
import { customersApi } from '@/src/libs/api/crm'
import { uploadIdDocument } from '@/src/app/(app)/(dashboard)/crm/customers/_actions/upload-id-document'
import { getUnitsOfMeasure } from '../../inventory/items/_actions/get-lookup-data'
import {
  itemLookup,
  createTransaction,
  addPayment,
  validatePromoCode,
  parkSale,
  searchCustomers,
  createWalkInCustomer,
  getLoyaltyByCustomer,
  earnPoints,
  redeemPoints,
  getCustomerTransactions,
  getActiveLoyaltyProgram,
  getActivePosConfig,
  validateManagerByPin,
  syncTransactions,
  updateSessionDisplay,
  getPaymentMethods,
  getEnabledBranchPaymentMethods,
  getReceiptBranding,
  getAvailableSerialNumbers,
  getCompanyWideSerialAvailability,
  requestStockFromBranch,
  submitCancellationRequest,
  getCancellationRequestStatus,
  cancelReleaseFormRequest,
  getActiveFinancingTerms,
  getActiveTpfProviders,
  previewInstallment,
  createSkuReservation,
  createCustomerAdvance,
  getPosPriceUseTypes,
  searchSerialsAcrossItems,
  type SerialNumberRecord,
  type PosPriceUseType,
} from '../_actions/pos-actions'
import { DEFAULT_VAT_RATE } from '../_actions/pos-constants'
import { getCreditApplications } from '../credit-applications/_actions/get-applications'
import { getPromissoryNote } from '../credit-applications/_actions/get-promissory-note'
import { signPromissoryNote } from '../credit-applications/_actions/sign-promissory-note'
import { CREDIT_PERMISSIONS } from '@/src/libs/guards/credit-permissions'
import type { PromissoryNote } from '@/src/schema/credit/applications'
import PriceUseSelector from './_components/PriceUseSelector'
import PriceOverrideDialog from './_components/PriceOverrideDialog'
import { usePriceResolution, resolutionKey } from './_hooks/usePriceResolution'
import { isPendingApproval, isRefundPendingApproval } from '@/src/schema/pos'
import type {
  PosPaymentMethod,
  PosCardTxnMode,
  PosInvoiceType,
  InstallmentProvider,
  PayNowMethod,
  PromoValidationResult,
  PosCustomer,
  LoyaltyAccount,
  LoyaltyProgram,
  PosTransaction,
  PosTransactionInvoice,
  SyncTransactionItem,
  FinancingTerm,
  TpfProvider,
  InstallmentPreview,
} from '@/src/schema/pos'

// ─── Types ────────────────────────────────────────────────────────────────────

interface LookupItem {
  id: string
  name: string
  sku?: string
  barcode?: string | null
  price: number
  stockQty?: number
  taxRateId?: string | null
  taxRate?: number | null
  baseUnitId?: string
  uomCode?: string
  allowDecimal?: boolean
  isBundle?: boolean
  pricingMode?: 'inclusive' | 'exclusive' | null
  isSerialTracked?: boolean
  requiresSecondarySerial?: boolean
  /** Raw shape from GET /pos/catalog — flattened into brandName below. */
  brand?: { id: string; name: string } | null
  brandName?: string | null
  category?: { id: string; name: string } | null
  modelNumber?: string | null
}

interface CartLine {
  // Unique per physical unit — itemId alone is no longer unique once a
  // serial-tracked item can have multiple units (multiple lines) in the
  // same cart, each needing its own serial.
  lineId: string
  itemId: string
  itemName: string
  sku?: string
  /** Brand / Group (category) / Model — shown instead of itemName wherever
   * all three are present (see itemDisplayLabel()); falls back to itemName
   * otherwise, since not every item has these populated. */
  brandName?: string | null
  categoryName?: string | null
  modelNumber?: string | null
  unitPrice: number
  quantity: number
  taxRate?: number | null
  uomCode?: string
  allowDecimal?: boolean
  pricingMode?: 'inclusive' | 'exclusive' | null
  isSerialTracked?: boolean
  serialNumberId?: string
  serialNumberLabel?: string
  requiresSecondarySerial?: boolean
  secondarySerialNumberId?: string
  secondarySerialNumberLabel?: string
  /** This line's own Price Use (WIP/CR-BR/SSC/etc.) — each cart line can
   * resolve against a different one. Defaults to WIP when the item is
   * added. */
  priceUseTypeId?: string
  /** PriceListItem this line's unitPrice resolved to under the line's own
   * selected Price Use — null until resolved, stays null if manually
   * overridden instead. */
  priceListItemId?: string | null
  /** Scenario 15, Part 5 — curated per-SKU down payment from the real NIG
   * rate card, resolved alongside priceListItemId. Preferred over the
   * generic 10%-floor auto-fill when set. */
  priceListDownPayment?: number | null
  /** True once unitPrice reflects either a real Price Use resolution or a
   * manual override — false means still pending / no match, and checkout
   * submission should be blocked on this line. */
  priceResolved?: boolean
  /** Set once a manager PIN-approves a manual price on this line. A
   * Price Use change must not silently clobber this. */
  priceOverrideBy?: string | null
  priceOverrideApproverName?: string
  /** Per-line payment mode — a cart can mix cash/installment lines.
   * Defaults to 'cash' when unset. Installment lines carry their own
   * financingTermId + down payment, independent of every other line. */
  invoiceType?: PosInvoiceType
  /** Which financing an installment line runs on — 'inhouse' (default,
   * unset) or 'tpf'. Only meaningful when invoiceType is 'installment'. */
  installmentProvider?: InstallmentProvider
  /** Cosmetic sub-choice for a 'cash'-mode line — how the customer intends
   * to pay, for receipt/reporting only. Never affects the PAYMENT section. */
  payNowMethod?: PayNowMethod
  financingTermId?: string
  downPaymentInput?: string
}

interface PaymentRow {
  method: PosPaymentMethod
  amount: number
  referenceNumber: string
  // populated for custom / configured methods
  configId?: string
  refFieldLabel?: string
  refRequired?: boolean
  refRegex?: string
  // Scenario 37 — bank for bank_transfer, gateway for qr. Card's terminal
  // choice comes from the transaction-scoped cardTerminalOptionId state
  // instead (set via Item Payment Mode), not stored per-row.
  paymentMethodOptionId?: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAYMENT_LABELS: Record<PosPaymentMethod, string> = {
  cash: 'Cash',
  card: 'Card',
  gcash: 'GCash',
  maya: 'Maya',
  gift_card: 'Gift Card',
  store_credit: 'Store Credit',
  loyalty_points: 'Loyalty Points',
  bank_transfer: 'Bank Transfer',
  tpf: 'TPF Settlement',
  qr: 'QR',
  custom: 'Custom',
}

const REF_METHODS: PosPaymentMethod[] = [
  'card',
  'bank_transfer',
  'gift_card',
  'gcash',
  'maya',
  'tpf',
  'qr',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n)

/** Brand / Group / Model instead of the long free-text name, wherever all
 * three are populated on the item — falls back to the name when any of
 * them is missing, since not every catalog item has brand/category/model
 * filled in. */
function itemDisplayLabel(item: {
  name: string
  brandName?: string | null
  categoryName?: string | null
  modelNumber?: string | null
}): string {
  if (item.brandName && item.categoryName && item.modelNumber) {
    return `${item.brandName}  ·  ${item.categoryName}  ·  ${item.modelNumber}`
  }
  return item.name
}

function lineTotal(line: CartLine) {
  return line.unitPrice * line.quantity
}

function customerDisplayName(c: PosCustomer) {
  return c.name || `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || 'Customer'
}

const OFFLINE_QUEUE_KEY = 'pos_offline_queue'
const POS_FROM_TAB_KEY = 'pos_from_tab'

const DECIMAL_CODES = new Set([
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CheckoutPage() {
  const router = useRouter()
  const { branchId: switcherBranchId } = usePosBranchContext()
  const { data: sessionsData, isLoading: sessionsLoading } = useSessions({
    status: 'open',
    ...(switcherBranchId ? { branchId: switcherBranchId } : {}),
  })
  const rawSessions = sessionsData?.data
  const openSessions = useMemo(() => rawSessions ?? [], [rawSessions])

  // Session
  const [sessionId, setSessionId] = useState('')

  // Flat VAT rate applied to every checkout — no longer configurable.
  const activeTaxRate = DEFAULT_VAT_RATE

  // Catalog
  const [catalogItems, setCatalogItems] = useState<LookupItem[]>([])
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [catalogError, setCatalogError] = useState('')
  // Whether the currently-loaded catalogItems reflect a real, branch-scoped
  // stock count. Without a resolved branch (e.g. multiple open sessions and
  // none picked yet), the backend can't compute per-branch stock and every
  // item's stockQty defaults to 0 — that 0 must never be treated as "genuinely
  // out of stock" until this is true.
  const [catalogStockKnown, setCatalogStockKnown] = useState(false)

  // Enabled payment methods for the active branch
  const [enabledPaymentMethods, setEnabledPaymentMethods] = useState<PosPaymentMethod[]>(
    Object.keys(PAYMENT_LABELS) as PosPaymentMethod[]
  )

  // Auth session branchId — Branch Managers are scoped to their assigned branch,
  // which is the same branch they can configure via "My Branch" settings.
  const [authBranchId, setAuthBranchId] = useState<string | null>(null)
  const [isBranchManager, setIsBranchManager] = useState(false)
  // Whether this login already holds the approval authority a serialized
  // sale would otherwise need to ask someone else for (Business Owner or
  // Branch Manager) — drives the serial-sale banner below.
  const [canOverride, setCanOverride] = useState(false)
  // Scenario 17 Part 7 — whether this login can mark a Promissory Note as
  // signed (Cashier-level, cascades to Branch Manager/Business Owner).
  const [canSignPromissoryNote, setCanSignPromissoryNote] = useState(false)
  useEffect(() => {
    getSessionOrNull().then((s) => {
      if (!s) {
        router.replace('/login')
        return
      }
      // Scenario 22 Part 5 — checkout had no route-level permission check at
      // all (only ModuleGuard's broad "holds SOME pos permission" check at
      // the layout level). A role without pos:transactions:create could
      // still load this screen; every actual sale-submit call already
      // 403s from the backend, but the page itself shouldn't render for
      // them in the first place.
      if (!can(s, POS_PERMISSIONS.TRANSACTIONS_CREATE)) {
        router.replace('/403')
        return
      }
      setIsBranchManager(s.primaryRole === 'Branch Manager')
      setAuthBranchId(s.branchId ?? null)
      setCanOverride(can(s, POS_PERMISSIONS.TRANSACTIONS_OVERRIDE))
      setCanSignPromissoryNote(can(s, CREDIT_PERMISSIONS.PROMISSORY_NOTE_SIGN))
    })
  }, [router])

  const activeBranchId = useMemo(() => {
    // Branch Managers: use their assigned branch (matches "My Branch" settings)
    if (isBranchManager && authBranchId) return authBranchId
    // Everyone else: use the terminal's branch
    const session = openSessions.find((s) => s.id === sessionId)
    return session?.terminal?.branchId ?? (session?.terminal as any)?.branch?.id ?? null
  }, [openSessions, sessionId, isBranchManager, authBranchId])

  // Cart
  const [cart, setCart] = useState<CartLine[]>([])

  // Item search
  const [searchQuery, setSearchQuery] = useState('')
  const [catalogViewMode, setCatalogViewMode] = useState<'grid' | 'list'>('list')
  // Serial-number search from the same box — the item catalog is preloaded
  // client-side, but serials aren't (there can be thousands), so this is a
  // separate debounced backend call merged into displayItems.
  const [serialSearchResults, setSerialSearchResults] = useState<SerialNumberRecord[]>([])

  // Serial number picker
  const [serialPickerTarget, setSerialPickerTarget] = useState<CartLine | null>(null)
  const [serialPickerStage, setSerialPickerStage] = useState<'primary' | 'secondary'>('primary')
  const [serialNumbers, setSerialNumbers] = useState<SerialNumberRecord[]>([])
  const [serialLoading, setSerialLoading] = useState(false)
  const [serialError, setSerialError] = useState('')
  const [serialSearchQuery, setSerialSearchQuery] = useState('')
  // Read-only "also available elsewhere" section — never sellable from here.
  const [elsewhereSerials, setElsewhereSerials] = useState<SerialNumberRecord[]>([])
  // Which branch's individual serials are showing in the side panel —
  // master-detail style, one at a time; null means the panel is closed and
  // the summary view stays compact.
  const [expandedBranch, setExpandedBranch] = useState<string | null>(null)
  // Part 3 — one-tap request status per SERIAL id (a specific unit can now
  // be requested, not just "first available"), reset whenever the picker
  // opens for a different item.
  const [serialRequestStatus, setSerialRequestStatus] = useState<
    Record<string, 'loading' | 'requested' | 'error'>
  >({})
  // Confirmation step before a cross-branch stock request actually fires —
  // set when the cashier clicks "Request", cleared on confirm/cancel.
  const [pendingStockRequest, setPendingStockRequest] = useState<SerialNumberRecord | null>(null)

  async function confirmStockRequest(sn: SerialNumberRecord) {
    if (!sn.currentWarehouseId || !serialPickerTarget) return
    setSerialRequestStatus((prev) => ({ ...prev, [sn.id]: 'loading' }))
    const res = await requestStockFromBranch({
      itemId: serialPickerTarget.itemId,
      serialNumberId: sn.id,
      fromWarehouseId: sn.currentWarehouseId,
      toBranchId: activeBranchId ?? undefined,
      customerName: selectedCustomer ? customerDisplayName(selectedCustomer) : undefined,
    })
    setSerialRequestStatus((prev) => ({
      ...prev,
      [sn.id]: res.success ? 'requested' : 'error',
    }))
  }

  // Customer
  const [selectedCustomer, setSelectedCustomer] = useState<PosCustomer | null>(null)
  const [loyaltyAccount, setLoyaltyAccount] = useState<LoyaltyAccount | null>(null)
  const [loyaltyProgram, setLoyaltyProgram] = useState<LoyaltyProgram | null>(null)
  const [customerHistory, setCustomerHistory] = useState<PosTransaction[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerResults, setCustomerResults] = useState<PosCustomer[]>([])
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false)
  const [searchingCustomers, setSearchingCustomers] = useState(false)
  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false)
  const customerTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Tax exempt
  const [isTaxExempt, setIsTaxExempt] = useState(false)
  const [taxExemptionRef, setTaxExemptionRef] = useState('')

  // Promo
  const [promoInput, setPromoInput] = useState('')
  const [promoResult, setPromoResult] = useState<PromoValidationResult | null>(null)
  const [promoError, setPromoError] = useState('')
  const [validatingPromo, setValidatingPromo] = useState(false)

  // One payment mode for the whole cart — never per item (the old per-item
  // Cash/Installment/Debit-Credit Card dropdown, unchanged in its options,
  // just applied to every line at once via the toggle's onClick below
  // instead of chosen per line). If any item needs a different mode, that's
  // a separate transaction.
  const [paymentMode, setPaymentMode] = useState<'cash' | 'installment' | 'credit_card'>('cash')

  // Payment
  const [payments, setPayments] = useState<PaymentRow[]>([])
  // Scenario 37 — card details captured once via the Payment Mode toggle
  // (transaction-scoped, see hasCreditCardLine), then carried into whatever
  // Card payment row gets added below.
  const [cardTerminalOptionId, setCardTerminalOptionId] = useState<string | undefined>()
  const [cardTxnMode, setCardTxnMode] = useState<PosCardTxnMode>('straight')
  const [cardInstallmentTerm, setCardInstallmentTerm] = useState<number | undefined>()
  // Scenario 37 — same treatment for Cash's own sub-choice (Cash on Hand /
  // Bank Transfer / QR), captured once via Item Payment Mode (transaction-
  // scoped, see hasCashLine), carried into whatever payment row gets added.
  const [cashSubMode, setCashSubMode] = useState<'cash_on_hand' | 'bank_transfer' | 'qr'>(
    'cash_on_hand'
  )
  const [cashPaymentOptionId, setCashPaymentOptionId] = useState<string | undefined>()
  // Scenario 38 Gap 7 — the cashier confirms the transfer already landed at
  // the register (e.g. checked the business's own banking app in real
  // time), so it posts straight to Cash in Bank instead of the usual
  // clearing account. Same transaction-scoped treatment as cardTxnMode/
  // cashSubMode above; only meaningful while cashSubMode is bank_transfer.
  const [bankTransferVerifiedAtRegister, setBankTransferVerifiedAtRegister] = useState(false)

  // Down payment now shares the cash/card state above (see hasCashLine/
  // hasCreditCardLine below) and the same `payments` pool — paymentMode
  // itself stays 'installment' to keep routing cart lines to the financing
  // path, so this one small toggle carries just the cash-vs-card choice for
  // tendering the down payment. Starts unset on purpose: the cashier must
  // explicitly choose before a payment row is offered.
  const [installmentPaymentMethod, setInstallmentPaymentMethod] = useState<
    'cash' | 'credit_card' | undefined
  >()
  // Both providers' down payments are collected at this register and share
  // the one toggle above — the money crosses the counter identically
  // whether NIG or a financier carries the balance afterwards.

  // Optional flat delivery fee — collected now via the regular Payment
  // section regardless of payment mode, kept out of subtotal/totalAmount so
  // it never affects an installment line's financed amount or 10% floor.
  const [deliveryFeeInput, setDeliveryFeeInput] = useState('')
  // Collection receipt reference for the delivery fee specifically — kept
  // apart from the main payment's own CR Reference, since the fee is a
  // transaction-level charge, not tied to any one payment.
  const [deliveryFeeReferenceNumberInput, setDeliveryFeeReferenceNumberInput] = useState('')

  // Configured payment methods from API — falls back to hardcoded list if not loaded
  const [configuredMethods, setConfiguredMethods] = useState<
    import('@/src/schema/pos').PaymentMethodConfig[]
  >([])

  // Sale mode: 'sale' is a normal checkout, where each cart line picks its
  // own Cash / Charge / Installment mode independently (a cart can mix all
  // three). 'reserve' (Scenario 03 — reserve one item by SKU, no serial
  // required yet, with an optional deposit) stays a separate, whole-cart,
  // single-item mode that never creates a PosTransaction at all — kept as
  // its own top-level toggle since it isn't a payment mode a line can pick.
  const [saleMode, setSaleMode] = useState<'sale' | 'reserve'>('sale')

  // Installment financing — financingTerms is shared (fetched once), but
  // the term/down-payment/preview a cashier picks are per cart LINE now,
  // not one global selection, so a cart can finance different items under
  // different terms. Keyed by CartLine.lineId.
  const [financingTerms, setFinancingTerms] = useState<FinancingTerm[]>([])
  // TPF financing — one financier/reference covers however many TPF-mode
  // lines are in the cart, mirroring how one creditApplicationId already
  // covers however many inhouse installment lines.
  const [tpfProviders, setTpfProviders] = useState<TpfProvider[]>([])
  const [tpfProviderId, setTpfProviderId] = useState('')
  const [tpfReferenceNumber, setTpfReferenceNumber] = useState('')
  const [tpfApprovedAmount, setTpfApprovedAmount] = useState('')
  const [installmentPreviews, setInstallmentPreviews] = useState<
    Record<string, InstallmentPreview | null>
  >({})
  const [installmentPreviewErrors, setInstallmentPreviewErrors] = useState<
    Record<string, string | null>
  >({})
  const [installmentPreviewLoading, setInstallmentPreviewLoading] = useState<
    Record<string, boolean>
  >({})
  const installmentPreviewTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  // Down payment is a flat 10%-of-sale-amount floor, never a function of the
  // chosen term — shown by default as a fixed stat so it doesn't read as an
  // editable box that mysteriously never changes. Keyed by line.lineId (the
  // same key the displayGroups card uses) so each item's reveal is independent.
  const [downPaymentEditOpen, setDownPaymentEditOpen] = useState<Record<string, boolean>>({})

  // Scenario 37 — the tender row's method already comes from Item Payment
  // Mode by default (see preferredPaymentMethodKey) — showing an always-open
  // dropdown for the same choice reads as asking twice. Default to a plain
  // label instead, same "reveal on demand" pattern as downPaymentEditOpen
  // above. Keyed by row index.
  const [paymentMethodEditOpen, setPaymentMethodEditOpen] = useState<Record<number, boolean>>({})

  // Scenario 17 Part 6 — every installment sale requires an approved,
  // not-yet-used CreditApplication for the selected customer. Corrected
  // 2026-08-15, second pass — applications can cover a bundle of models;
  // checkout requires an exact match against the sale's installment lines
  // (enforced server-side in TransactionsService.validateAndPrepare).
  const [approvedCreditApplications, setApprovedCreditApplications] = useState<
    {
      id: string
      applicationNumber: string
      requestedAmount: number
      items: { itemName: string }[]
    }[]
  >([])
  const [creditApplicationId, setCreditApplicationId] = useState('')
  const [creditApplicationsLoading, setCreditApplicationsLoading] = useState(false)

  // Park sale
  const [showParkModal, setShowParkModal] = useState(false)
  const [parkLabel, setParkLabel] = useState('')
  const [parking, setParking] = useState(false)

  // Cancellation request
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelSubmitting, setCancelSubmitting] = useState(false)
  const [cancelError, setCancelError] = useState('')
  const [cancellationReqId, setCancellationReqId] = useState<string | null>(null)
  const cancellationPollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // POS config
  const [discountThreshold, setDiscountThreshold] = useState(20)
  const [allowNegativeStock, setAllowNegativeStock] = useState(false)
  const [inclusivePricing, setInclusivePricing] = useState(false)

  // Manager override
  const [managerOverrideApproved, setManagerOverrideApproved] = useState(false)
  const [overrideManagerName, setOverrideManagerName] = useState('')
  const [showOverrideDialog, setShowOverrideDialog] = useState(false)
  const [overrideManagerId, setOverrideManagerId] = useState('')
  const [overridePin, setOverridePin] = useState('')
  const [overrideError, setOverrideError] = useState('')
  const [overridePending, setOverridePending] = useState(false)

  // Price Use (Price List integration) — each cart line picks its own
  const [priceUseTypes, setPriceUseTypes] = useState<PosPriceUseType[]>([])
  const [priceOverrideTargetLineId, setPriceOverrideTargetLineId] = useState<string | null>(null)
  const priceResolutionLines = useMemo(
    () => cart.map((l) => ({ itemId: l.itemId, priceUseTypeId: l.priceUseTypeId })),
    [cart]
  )
  const { prices: resolvedPrices, isResolving: isResolvingPrices } = usePriceResolution(
    priceResolutionLines,
    activeBranchId ?? undefined
  )

  // Back-fills each cart line's unitPrice from the bulk resolution — skips
  // any line that already has a manual priceOverrideBy (a PIN-approved
  // value a Price Use change must not silently clobber).
  useEffect(() => {
    setCart((prev) =>
      prev.map((line) => {
        if (line.priceOverrideBy) return line
        if (!line.priceUseTypeId) return line
        const resolved = resolvedPrices[resolutionKey(line.itemId, line.priceUseTypeId)]
        if (!resolved) {
          // No active price list matches this line's picked Price Use — clear
          // unitPrice back to 0 too, not just the resolved flags. Leaving the
          // old Price Use's unitPrice in place kept the Order Summary total
          // frozen on the stale price even though the per-line cell correctly
          // switched to "No price — Override".
          return line.priceResolved
            ? {
                ...line,
                unitPrice: 0,
                priceResolved: false,
                priceListItemId: null,
                priceListDownPayment: null,
              }
            : line
        }
        if (line.priceListItemId === resolved.priceListItemId && line.priceResolved) return line
        return {
          ...line,
          unitPrice: resolved.price,
          priceListItemId: resolved.priceListItemId,
          priceListDownPayment: resolved.downPayment,
          priceResolved: true,
        }
      })
    )
  }, [resolvedPrices])

  // Submit
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<{
    transactionId: string
    transactionNumber: string
    change: number
    journalEntryId?: string | null
    arInvoiceId?: string | null
    salesInvoiceNumber?: string | null
    deliveryReceiptNumber?: string | null
    loyaltyEarned: boolean
    offlineBuffered?: boolean
    // Per-line outcome — a cart can mix cash/charge/installment lines, so
    // there's no single invoiceType/installmentPreview for the whole sale
    // anymore. Empty for an offline-buffered sale (always pure cash).
    lineOutcomes: {
      lineId: string
      itemName: string
      invoiceType: PosInvoiceType
      installmentProvider?: InstallmentProvider | null
      installmentPreview?: InstallmentPreview | null
      /** TPF lines only — what the customer paid here vs. what the
       * financier funds. Inhouse lines carry theirs in installmentPreview. */
      downPayment?: number | null
      financedBalance?: number | null
    }[]
    invoices?: PosTransactionInvoice[]
  } | null>(null)

  // Pending manager approval (serial-tracked sale awaiting Release Form review)
  const [pendingApproval, setPendingApproval] = useState<{
    releaseFormRequestId: string
    totalAmount: number
    serialLines: { itemName: string; serialNumberLabel?: string }[]
    /** Scenario 17 Part 7 — set only for installment sales, so
     * PendingApprovalScreen knows whether to show the Promissory Note card. */
    creditApplicationId?: string
  } | null>(null)

  // Reserve mode success (Scenario 03, Part 3) — separate from `success`
  // since a reservation is never a PosTransaction.
  const [reservationSuccess, setReservationSuccess] = useState<{
    reservationId: string
    itemName: string
    quantity: number
    customerName: string
    depositAmount: number
  } | null>(null)

  // Offline mode
  const [isOffline, setIsOffline] = useState(false)
  const [syncingOffline, setSyncingOffline] = useState(false)
  const [pendingManagerReview, setPendingManagerReview] = useState<
    Array<{ index: number; transactionNumber?: string; reason: string }>
  >([])

  // QMS tab handoff metadata (set when checkout is opened from a restaurant tab)
  const [fromTab, setFromTab] = useState<{
    tabId: string
    tableId: string
    tableName: string
    posTransactionId?: string
  } | null>(null)

  // Mobile tab panel — switches between catalog and checkout on small screens
  const [mobilePanel, setMobilePanel] = useState<'catalog' | 'checkout'>('catalog')

  // Measured-item quantity dialog
  const [measuredItem, setMeasuredItem] = useState<LookupItem | null>(null)
  const [measuredQtyInput, setMeasuredQtyInput] = useState('')

  // Load configured payment methods once
  useEffect(() => {
    getPaymentMethods().then((res) => {
      if (res.success && res.data?.data?.length) {
        setConfiguredMethods(
          res.data.data.filter((m) => m.isEnabled).sort((a, b) => a.displayOrder - b.displayOrder)
        )
      }
    })
  }, [])

  // Auto-select the only open session; clear stale sessionId when session is
  // no longer open OR when it belongs to a different branch than the one
  // currently selected in the switcher. The second check matters because
  // useSessions() keeps showing the previous branch's sessions (React
  // Query's placeholderData: keepPreviousData) for a moment after
  // switcherBranchId changes and before the refetch lands — without it, a
  // sale made right after switching branches could silently reuse a session
  // from the branch you just left, with nothing afterward ever catching the
  // mismatch since it no longer looks "stale" once the refetch does land.
  useEffect(() => {
    if (!sessionsData) return
    const currentSession = openSessions.find((s) => s.id === sessionId)
    const currentSessionBranchId =
      currentSession?.terminal?.branchId ?? currentSession?.terminal?.branch?.id
    const isStale =
      sessionId &&
      (!currentSession || (switcherBranchId && currentSessionBranchId !== switcherBranchId))
    if (isStale) {
      setSessionId(openSessions.length === 1 ? openSessions[0].id : '')
    } else if (openSessions.length === 1 && !sessionId) {
      setSessionId(openSessions[0].id)
    }
  }, [openSessions, sessionsData, sessionId, switcherBranchId])

  // Load catalog when session is selected, then enrich with UOM data
  useEffect(() => {
    if (!sessionsData) return
    const session = openSessions.find((s) => s.id === sessionId)
    const branchId = session?.terminal?.branchId ?? session?.terminal?.branch?.id
    setCatalogLoading(true)
    setCatalogError('')

    Promise.all([
      itemLookup(undefined, branchId),
      getUnitsOfMeasure().catch(() => ({ success: false, data: null })),
    ])
      .then(([catalogRes, uomRes]) => {
        if (!catalogRes.success) {
          setCatalogError(catalogRes.error ?? 'Failed to load items')
          return
        }
        const raw = (catalogRes.data ?? []) as LookupItem[]

        const uomMap = Object.fromEntries((uomRes.data?.data ?? []).map((u) => [u.id, u]))

        const enriched = raw.map((item) => {
          const withBrand =
            item.brandName === undefined ? { ...item, brandName: item.brand?.name ?? null } : item
          if (withBrand.uomCode || withBrand.allowDecimal) return withBrand
          const uom = withBrand.baseUnitId ? uomMap[withBrand.baseUnitId] : undefined
          if (!uom) return withBrand
          const uomCode = uom.code
          const allowDecimal =
            uom.allowDecimal === true ||
            (uom.allowDecimal !== false && DECIMAL_CODES.has(uomCode.toLowerCase()))
          return { ...withBrand, uomCode, allowDecimal }
        })

        setCatalogItems(enriched)
        setCatalogStockKnown(!!branchId)
      })
      .catch(() => setCatalogError('Failed to load items'))
      .finally(() => setCatalogLoading(false))
  }, [sessionId, openSessions, sessionsData])

  // Fetch enabled payment methods whenever the active branch changes
  useEffect(() => {
    if (!activeBranchId) {
      setEnabledPaymentMethods(Object.keys(PAYMENT_LABELS) as PosPaymentMethod[])
      return
    }
    getEnabledBranchPaymentMethods(activeBranchId).then((res) => {
      if (res.success && res.data && res.data.length > 0) {
        setEnabledPaymentMethods(res.data)
      } else {
        setEnabledPaymentMethods(Object.keys(PAYMENT_LABELS) as PosPaymentMethod[])
      }
    })
  }, [activeBranchId])

  // Load POS config for discount override threshold, stock settings, and pricing mode
  useEffect(() => {
    getActivePosConfig().then((res) => {
      if (res.success && res.data) {
        setDiscountThreshold(Number(res.data.discountOverrideThreshold ?? 20))
        setAllowNegativeStock(res.data.allowNegativeStock ?? false)
        setInclusivePricing(res.data.defaultPricingMode === 'inclusive')
      }
    })
  }, [])

  // Load Price Use types for each line's own selector — data-driven, not a
  // hardcoded list, since these are user-managed (Inventory > Price Use Types).
  // New cart lines default to WIP (Walk-In Price) — the only Price Use with
  // full price-list coverage today and the one a walk-in cash/installment
  // sale should use unless the cashier picks otherwise per line.
  useEffect(() => {
    getPosPriceUseTypes().then((res) => {
      if (res.success && Array.isArray(res.data)) {
        setPriceUseTypes(res.data)
      }
    })
  }, [])

  // Clear a stale submit-time validation error as soon as the cart changes —
  // e.g. removing/swapping the line that triggered a cross-branch serial
  // rejection — instead of leaving the old message on screen until the next
  // submit attempt.
  useEffect(() => {
    setError('')
  }, [cart])

  // Fetch serial numbers when picker target or stage (primary/secondary) changes
  useEffect(() => {
    if (!serialPickerTarget) return
    setSerialLoading(true)
    setSerialNumbers([])
    setSerialError('')
    setSerialSearchQuery('')
    setSerialRequestStatus({})
    setExpandedBranch(null)
    getAvailableSerialNumbers(serialPickerTarget.itemId, activeBranchId ?? undefined).then(
      (res) => {
        if (res.success && Array.isArray(res.data)) {
          setSerialNumbers(res.data)
        } else if (!res.success) {
          // A failed fetch (e.g. missing permission) must not look like
          // "zero serials in stock" — that's a data state, this is an error.
          setSerialError(res.error || 'Failed to load serial numbers.')
        }
        setSerialLoading(false)
      }
    )
  }, [serialPickerTarget?.itemId, serialPickerStage, activeBranchId])

  // Read-only "also available elsewhere" lookup — purely informational, so a
  // failure here stays silent rather than surfacing as a picker-blocking
  // error the way the sellable fetch above does.
  useEffect(() => {
    if (!serialPickerTarget) {
      setElsewhereSerials([])
      return
    }
    getCompanyWideSerialAvailability(serialPickerTarget.itemId, activeBranchId ?? undefined).then(
      (res) => {
        if (res.success && Array.isArray(res.data)) {
          setElsewhereSerials(res.data)
        } else {
          setElsewhereSerials([])
        }
      }
    )
  }, [serialPickerTarget?.itemId, serialPickerStage, activeBranchId])

  // Resume a parked sale or QMS tab stored in localStorage
  useEffect(() => {
    const raw = localStorage.getItem('pos_resumed_cart')
    if (raw) {
      try {
        const data = JSON.parse(raw) as { lines?: CartLine[] }
        if (Array.isArray(data.lines) && data.lines.length > 0) setCart(data.lines)
      } catch {}
      localStorage.removeItem('pos_resumed_cart')
    }
    const tabMeta = localStorage.getItem(POS_FROM_TAB_KEY)
    if (tabMeta) {
      try {
        const meta = JSON.parse(tabMeta) as {
          tabId: string
          tableId: string
          tableName: string
          posTransactionId?: string
        }
        setFromTab(meta)
      } catch {}
    }
  }, [])

  // Network detection
  useEffect(() => {
    setIsOffline(!navigator.onLine)
    const handleOffline = () => setIsOffline(true)
    const handleOnline = () => {
      setIsOffline(false)
      // auto-sync queued transactions
      const raw = localStorage.getItem(OFFLINE_QUEUE_KEY)
      if (!raw) return
      let queue: SyncTransactionItem[]
      try {
        queue = JSON.parse(raw)
      } catch {
        return
      }
      if (!queue.length) return
      setSyncingOffline(true)
      syncTransactions({ transactions: queue })
        .then((res) => {
          if (res.success && res.data) {
            localStorage.removeItem(OFFLINE_QUEUE_KEY)
            if (res.data.pendingManagerReview?.length) {
              setPendingManagerReview(res.data.pendingManagerReview)
            }
          }
        })
        .finally(() => setSyncingOffline(false))
    }
    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)
    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    }
  }, [OFFLINE_QUEUE_KEY])

  // Debounced customer search
  useEffect(() => {
    if (!customerSearch.trim()) {
      setCustomerResults([])
      setCustomerSearchOpen(false)
      return
    }
    if (customerTimer.current) clearTimeout(customerTimer.current)
    customerTimer.current = setTimeout(async () => {
      setSearchingCustomers(true)
      const res = await searchCustomers(customerSearch.trim())
      setCustomerResults(res.data ?? [])
      setCustomerSearchOpen(true)
      setSearchingCustomers(false)
    }, 300)
    return () => {
      if (customerTimer.current) clearTimeout(customerTimer.current)
    }
  }, [customerSearch])

  // ─── Computed ─────────────────────────────────────────────────────────────

  const cartQtyMap = useMemo(
    () =>
      cart.reduce<Record<string, number>>((acc, l) => {
        acc[l.itemId] = (acc[l.itemId] ?? 0) + l.quantity
        return acc
      }, {}),
    [cart]
  )

  // Multiple units of the same serial-tracked item collapse into one cart
  // row (see addUnitOfItem) — everything else keeps one row per line, same
  // as before. Order preserved: a group's position is set by its first line.
  const displayGroups = useMemo(() => {
    const groups: CartLine[][] = []
    const indexByItemId = new Map<string, number>()
    for (const line of cart) {
      if (line.isSerialTracked && indexByItemId.has(line.itemId)) {
        groups[indexByItemId.get(line.itemId)!].push(line)
      } else {
        indexByItemId.set(line.itemId, groups.length)
        groups.push([line])
      }
    }
    return groups
  }, [cart])

  // Debounced (300ms, 3+ chars) — the instant client-side name/sku/barcode/
  // brand filter above keeps running regardless; this only adds serial hits
  // on top, since someone scanning/typing a serial has no reason to also
  // know the item's name.
  useEffect(() => {
    const q = searchQuery.trim()
    if (q.length < 3) {
      setSerialSearchResults([])
      return
    }
    let cancelled = false
    const timer = setTimeout(() => {
      searchSerialsAcrossItems(q, activeBranchId ?? undefined).then((res) => {
        if (!cancelled && res.success && Array.isArray(res.data)) setSerialSearchResults(res.data)
      })
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [searchQuery, activeBranchId])

  const displayItems = useMemo(() => {
    // A plain (non-serialized) bundle has no single sellable unit and stays
    // excluded; a serial-tracked bundle (e.g. a "Furniture Set") is sold and
    // registered as one unit like any other serialized item, so it's allowed
    // through here.
    const source = catalogItems.filter((item) => !item.isBundle || item.isSerialTracked)
    const q = searchQuery.trim().toLowerCase()
    let filtered = source
    if (q) {
      const serialMatchedItemIds = new Set(
        serialSearchResults.map((s) => s.item?.id).filter((id): id is string => !!id)
      )
      filtered = source.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.sku?.toLowerCase().includes(q) ||
          item.barcode?.toLowerCase().includes(q) ||
          item.brandName?.toLowerCase().includes(q) ||
          serialMatchedItemIds.has(item.id)
      )
    }
    // In-stock items first, out-of-stock after — the browsable catalog should
    // lead with what's actually sellable right now. Within each stock group,
    // priced items still sort before unpriced parts (needing a manager
    // override) so they don't interrupt the browsable, sellable catalog.
    return [...filtered].sort((a, b) => {
      const stockDelta = ((a.stockQty ?? 0) > 0 ? 0 : 1) - ((b.stockQty ?? 0) > 0 ? 0 : 1)
      if (stockDelta !== 0) return stockDelta
      return (a.price > 0 ? 0 : 1) - (b.price > 0 ? 0 : 1)
    })
  }, [catalogItems, searchQuery, serialSearchResults])

  const rawSubtotal = cart.reduce((s, l) => s + lineTotal(l), 0)

  const { vatExclSubtotalForBackend, additiveTax, taxTotal } = computePricingTotals({
    cart,
    rawSubtotal,
    inclusivePricing,
    activeTaxRate,
    isTaxExempt,
  })

  // Branch price overrides can give individual lines their own tax rate, so a
  // cart can legitimately mix rates — the summary line below reflects that
  // instead of always naming the tenant-wide default.
  const distinctLineTaxRates = Array.from(
    new Set(
      cart.map((l) => resolveLineTaxRate(l, activeTaxRate)).filter((r): r is number => r != null)
    )
  )
  const hasMixedTaxRates = distinctLineTaxRates.length > 1
  const uniformLineTaxRate = distinctLineTaxRates.length === 1 ? distinctLineTaxRates[0] : null

  const promoDiscount = promoResult?.valid ? (promoResult.discountAmount ?? 0) : 0

  // additiveTax is 0 for lines whose tax is already baked into unitPrice
  // (inclusive), and the real per-line tax for lines that still need it added
  // on top (exclusive) — correct for carts that mix both, not just carts that
  // uniformly match the tenant's global pricing-mode default.
  const subtotal = rawSubtotal + additiveTax

  const totalAmount = Math.max(0, Math.round((subtotal - promoDiscount) * 100) / 100)

  // ─── Per-line mode groupings ────────────────────────────────────────────
  // A cart can mix cash/installment lines (charge is no longer selectable,
  // kept only as a possible value on historical lines). cash is the default
  // for any line that hasn't explicitly picked installment.
  const cashCartLines = cart.filter((l) => (l.invoiceType ?? 'cash') === 'cash')
  const chargeCartLines = cart.filter((l) => l.invoiceType === 'charge')
  const installmentCartLines = cart.filter((l) => l.invoiceType === 'installment')
  // TPF: an outside financing company funds the balance at time of sale, so
  // it's collectible now (like cash) rather than through a local schedule —
  // but the customer's own down payment is still collected here first.
  const tpfInstallmentCartLines = installmentCartLines.filter(
    (l) => l.installmentProvider === 'tpf'
  )
  const inhouseInstallmentCartLines = installmentCartLines.filter(
    (l) => l.installmentProvider !== 'tpf'
  )
  const hasChargeOrInstallmentLine = chargeCartLines.length > 0 || installmentCartLines.length > 0
  // Cash and Debit-Credit Card both set invoiceType: 'cash' on every line —
  // Installment is the only value that routes to the separate financing
  // path. Derived from the one transaction-wide paymentMode, not per line.
  const cartInvoiceMode: 'cash' | 'installment' =
    paymentMode === 'installment' ? 'installment' : 'cash'
  // Scenario 37 — whether the cash bucket's one tender method (paymentMode,
  // set via the transaction-wide Payment Mode toggle — there's no per-item
  // choice anymore) is Credit Card. One card swipe covers whatever's being
  // paid by card in this sale, so the POS Terminal/Straight-Installment/Term
  // fields render once, not per line.
  const hasCreditCardLine =
    (cashCartLines.length > 0 && paymentMode === 'credit_card') ||
    (installmentCartLines.length > 0 && installmentPaymentMethod === 'credit_card')
  // Same for Cash's own sub-choice (Cash on Hand/Bank Transfer/QR). Also
  // covers the down payment's cash tendering now that it shares this pool —
  // cash-lines and installment-lines never coexist in one cart, so only one
  // of the two OR branches is ever true.
  const hasCashLine =
    (cashCartLines.length > 0 && paymentMode === 'cash') ||
    (installmentCartLines.length > 0 && installmentPaymentMethod === 'cash')

  // What's actually collectible at POS right now: cash-mode lines' full
  // value (net of promo discount, prorated by the cash lines' share of the
  // cart — for an all-cash cart that share is 1, so this reduces to exactly
  // the old subtotal-minus-discount total) plus every installment line's
  // own down payment. Charge-mode lines are excluded entirely (billed later
  // via AR) and an installment line's financed remainder is excluded too
  // (billed via its own schedule).
  const cashLinesGross =
    Math.round(
      cashCartLines.reduce(
        (s, l) => s + displayUnitPriceWithTax(l, activeTaxRate, inclusivePricing) * l.quantity,
        0
      ) * 100
    ) / 100
  const cashShareOfPromo = subtotal > 0 ? Math.min(1, cashLinesGross / subtotal) * promoDiscount : 0
  const cashLinesTotal = Math.max(0, Math.round((cashLinesGross - cashShareOfPromo) * 100) / 100)
  // TPF lines are collectible in full right now — but split across two
  // payers: the customer hands over the down payment at the register, the
  // financier funds the balance. tpfLinesTotal below is the gross of both.
  const tpfLinesGross =
    Math.round(
      tpfInstallmentCartLines.reduce(
        (s, l) => s + displayUnitPriceWithTax(l, activeTaxRate, inclusivePricing) * l.quantity,
        0
      ) * 100
    ) / 100
  const tpfShareOfPromo = subtotal > 0 ? Math.min(1, tpfLinesGross / subtotal) * promoDiscount : 0
  const tpfLinesTotal = Math.max(0, Math.round((tpfLinesGross - tpfShareOfPromo) * 100) / 100)
  const installmentDownPaymentsTotal =
    Math.round(
      inhouseInstallmentCartLines.reduce(
        (s, l) => s + (parseFloat(l.downPaymentInput ?? '0') || 0),
        0
      ) * 100
    ) / 100
  const tpfDownPaymentsTotal =
    Math.round(
      tpfInstallmentCartLines.reduce(
        (s, l) => s + (parseFloat(l.downPaymentInput ?? '0') || 0),
        0
      ) * 100
    ) / 100
  // Every down payment being collected at this register, whoever carries the
  // balance afterwards — inhouse and TPF share one tender method and one
  // pool, so the toggle labels itself with the combined figure.
  const allDownPaymentsTotal =
    Math.round((installmentDownPaymentsTotal + tpfDownPaymentsTotal) * 100) / 100
  // What the financier itself funds, once the customer's down payment is out.
  const tpfFinancedTotal = Math.max(
    0,
    Math.round((tpfLinesTotal - tpfDownPaymentsTotal) * 100) / 100
  )
  // A cart that's nothing BUT TPF lines is the one case the backend records
  // the financier's own settlement for by itself, at create time (see
  // transactions.service.ts's pure-TPF block) — so the register must collect
  // only the down payment here, or the financed half lands twice. A cart
  // that mixes TPF with cash/inhouse lines gets no such backend row, so it
  // keeps tendering the full TPF amount exactly as it always has.
  const isPureTpfCart =
    tpfInstallmentCartLines.length > 0 &&
    cashCartLines.length === 0 &&
    chargeCartLines.length === 0 &&
    inhouseInstallmentCartLines.length === 0
  const tpfCollectedAtRegister = isPureTpfCart ? tpfDownPaymentsTotal : tpfLinesTotal
  const deliveryFeeAmount = Math.max(0, parseFloat(deliveryFeeInput) || 0)
  // Grand total including the delivery fee, for customer-facing display only
  // (submit buttons, mobile bar, Order Summary) — totalAmount itself stays
  // fee-exclusive since it's what every per-line/down-payment calc is based on.
  const grandTotalWithFee = Math.round((totalAmount + deliveryFeeAmount) * 100) / 100

  // The down payment is tendered through this same Total + Delivery Fee
  // pool — one CR Number, one payment method, one balance. It's split back
  // out only when posting against each installment schedule at submit time
  // (see regularTenderTarget in handleConfirm), not in the UI. The delivery
  // fee rides in here too — it's due now regardless of payment mode, even
  // on a cart that's otherwise 100% installment.
  const regularTenderTarget =
    Math.round((cashLinesTotal + tpfCollectedAtRegister + deliveryFeeAmount) * 100) / 100
  const tenderTarget = Math.round((regularTenderTarget + installmentDownPaymentsTotal) * 100) / 100

  const totalPaid = Math.round(payments.reduce((s, p) => s + (p.amount || 0), 0) * 100) / 100
  const balance = Math.max(0, Math.round((tenderTarget - totalPaid) * 100) / 100)
  const change = totalPaid > tenderTarget ? Math.round((totalPaid - tenderTarget) * 100) / 100 : 0

  // Reserve mode has no tax/promo concept — SkuReservationsService values a
  // reservation as a flat item.sellingPrice × quantity, so the deposit cap
  // and "remaining at fulfilment" figure must track that instead of the
  // shared VAT/promo-inclusive totalAmount above.
  const reserveValue =
    saleMode === 'reserve' && cart.length === 1
      ? Math.round(cart[0].unitPrice * cart[0].quantity * 100) / 100
      : 0
  const reserveBalance = Math.max(0, Math.round((reserveValue - totalPaid) * 100) / 100)

  // Loyalty balance check
  const loyaltyPointsValue = loyaltyProgram?.pointsValue || 1
  const loyaltyPaymentRow = payments.find((p) => p.method === 'loyalty_points')
  const loyaltyPointsNeeded =
    loyaltyPaymentRow && loyaltyPaymentRow.amount > 0
      ? Math.max(1, Math.round(loyaltyPaymentRow.amount / loyaltyPointsValue))
      : 0
  const loyaltyOverBalance =
    loyaltyAccount != null &&
    loyaltyPointsNeeded > 0 &&
    loyaltyPointsNeeded > loyaltyAccount.currentPoints

  // Manager override check
  const discountPct = subtotal > 0 && promoDiscount > 0 ? (promoDiscount / subtotal) * 100 : 0
  const needsManagerOverride = discountThreshold > 0 && discountPct > discountThreshold

  // The Payment section used to start on an empty "+ Add payment method"
  // placeholder for every sale, reading as a missing/broken step rather than
  // an optional one. Pre-open one payment row the moment there's something
  // to collect, same defaulting addPaymentRow already does on a manual
  // click — reserve mode's deposit stays untouched since it's genuinely
  // optional there. On an installment cart, wait for the cashier to
  // explicitly choose Cash or Credit/Debit first (installmentPaymentMethod)
  // rather than silently defaulting to whatever's first configured.
  useEffect(() => {
    if (saleMode !== 'sale' || tenderTarget <= 0 || payments.length > 0) return
    if (installmentCartLines.length > 0 && !installmentPaymentMethod) return
    addPaymentRow()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    saleMode,
    tenderTarget,
    payments.length,
    installmentCartLines.length,
    installmentPaymentMethod,
  ])

  // Symmetric cleanup: if every cart line moves off cash/TPF (e.g. the last
  // one gets switched to installment), the row the effect above added must
  // not linger — otherwise payments.length > 0 keeps satisfying the Totals
  // block below and shows a stale, meaningless "Total Tendered" for a bucket
  // that no longer has anything in it.
  useEffect(() => {
    if (saleMode !== 'sale' || tenderTarget > 0 || payments.length === 0) return
    setPayments([])
  }, [saleMode, tenderTarget, payments.length])

  // Scenario 37 — keep every payment row that's still on its default (the
  // cashier hasn't picked a different method from the row's own dropdown)
  // live-synced with Item Payment Mode's current selection. Without this,
  // switching Item Payment Mode after a row already exists leaves the row
  // silently showing a stale method.
  useEffect(() => {
    const preferredKey = preferredPaymentMethodKey()
    if (!preferredKey) return
    const cfg = configuredMethods.find((m) => m.key === preferredKey)
    setPayments((prev) => {
      let changed = false
      const next = prev.map((p, i) => {
        if (paymentMethodEditOpen[i]) return p
        if (p.method === preferredKey && p.configId === cfg?.id) return p
        changed = true
        return {
          ...p,
          method: preferredKey,
          configId: cfg?.id,
          referenceNumber: '',
          refFieldLabel: cfg?.referenceFieldLabel ?? undefined,
          refRequired: cfg?.referenceIsRequired,
          refRegex: cfg?.referenceFieldRegex ?? undefined,
        }
      })
      return changed ? next : prev
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasCreditCardLine, hasCashLine, cashSubMode, configuredMethods, paymentMethodEditOpen])

  // ─── Installment financing (per-line) ──────────────────────────────────────

  useEffect(() => {
    if (saleMode !== 'sale' || installmentCartLines.length === 0) return
    getActiveFinancingTerms(activeBranchId ?? undefined).then((res) => {
      setFinancingTerms(res.data ?? [])
    })
    // Only re-fetch when a line first enters installment mode, not on every
    // keystroke — length-gated intentionally.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saleMode, activeBranchId, installmentCartLines.length > 0])

  useEffect(() => {
    if (saleMode !== 'sale' || tpfInstallmentCartLines.length === 0) {
      // No TPF line left in the cart — clear stale provider/reference state
      // so it can't silently carry over into a later, unrelated TPF line.
      setTpfProviderId('')
      setTpfReferenceNumber('')
      setTpfApprovedAmount('')
      return
    }
    getActiveTpfProviders().then((res) => {
      setTpfProviders(res.data ?? [])
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saleMode, tpfInstallmentCartLines.length > 0])

  // One debounced preview per installment line, keyed by lineId — each line
  // has its own amount/term/down-payment, so each gets its own preview call
  // (POST /pos/financing-terms/preview is already single-amount-scoped, no
  // backend change needed to call it once per line instead of once per cart).
  const installmentLinesDepKey = installmentCartLines
    .map(
      (l) =>
        `${l.lineId}:${l.financingTermId ?? ''}:${l.downPaymentInput ?? ''}:${l.unitPrice}:${l.quantity}`
    )
    .join('|')

  // Scenario 17 Part 6 — reload this customer's approved, unused credit
  // applications whenever the customer or cart's installment-line count
  // changes; a stale selection from a previously-selected customer must
  // never carry over. One credit application covers every installment line
  // in the cart (the backend gate runs once per transaction, not per line).
  useEffect(() => {
    setCreditApplicationId('')
    if (installmentCartLines.length === 0 || !selectedCustomer) {
      setApprovedCreditApplications([])
      return
    }
    setCreditApplicationsLoading(true)
    getCreditApplications({
      checkoutEligible: true, // Scenario 29 POS-02 — approved or partially_approved
      applicantCustomerId: selectedCustomer.id,
      unconsumed: true,
      limit: 50,
    })
      .then((res) => {
        setApprovedCreditApplications(
          (res.data?.data ?? [])
            .map((a) => {
              // Only the approved items are ever usable — a
              // partially_approved application's declined items are never
              // includable, so neither the displayed scope nor the total
              // should count them.
              const approvedOnly = (a.items ?? []).filter((i) => i.status === 'approved')
              return {
                id: a.id,
                applicationNumber: a.applicationNumber,
                // requestedAmount comes off the wire as a Prisma Decimal,
                // which JSON-serializes to a string — summing it unconverted
                // does string concatenation (0 + "8800" = "08800") instead
                // of addition.
                requestedAmount: approvedOnly.reduce(
                  (sum, i) => sum + Number(i.requestedAmount),
                  0
                ),
                items: approvedOnly.map((i) => ({
                  itemName: i.item?.name ?? '—',
                })),
              }
            })
            .filter((a) => a.items.length > 0)
        )
      })
      .finally(() => setCreditApplicationsLoading(false))
  }, [installmentCartLines.length, selectedCustomer])

  useEffect(() => {
    for (const line of installmentCartLines) {
      const lineAmount =
        Math.round(
          displayUnitPriceWithTax(line, activeTaxRate, inclusivePricing) * line.quantity * 100
        ) / 100
      const financingTermId = line.financingTermId
      if (!financingTermId || lineAmount <= 0) {
        setInstallmentPreviews((prev) => ({ ...prev, [line.lineId]: null }))
        setInstallmentPreviewErrors((prev) => ({ ...prev, [line.lineId]: null }))
        continue
      }
      if (installmentPreviewTimers.current[line.lineId]) {
        clearTimeout(installmentPreviewTimers.current[line.lineId])
      }
      installmentPreviewTimers.current[line.lineId] = setTimeout(async () => {
        setInstallmentPreviewLoading((prev) => ({ ...prev, [line.lineId]: true }))
        const downPayment = parseFloat(line.downPaymentInput ?? '0') || 0
        const res = await previewInstallment({
          totalAmount: lineAmount,
          downPayment,
          financingTermId,
        })
        setInstallmentPreviews((prev) => ({
          ...prev,
          [line.lineId]: res.success ? (res.data ?? null) : null,
        }))
        setInstallmentPreviewErrors((prev) => ({
          ...prev,
          [line.lineId]: res.success ? null : (res.error ?? null),
        }))
        setInstallmentPreviewLoading((prev) => ({ ...prev, [line.lineId]: false }))
      }, 300)
    }
    const activeLineIds = new Set(installmentCartLines.map((l) => l.lineId))
    for (const lineId of Object.keys(installmentPreviewTimers.current)) {
      if (!activeLineIds.has(lineId)) {
        clearTimeout(installmentPreviewTimers.current[lineId])
        delete installmentPreviewTimers.current[lineId]
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [installmentLinesDepKey])

  // ─── Push cart to customer display ────────────────────────────────────────

  const displayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!sessionId || success) return
    if (displayTimerRef.current) clearTimeout(displayTimerRef.current)
    displayTimerRef.current = setTimeout(() => {
      updateSessionDisplay(sessionId, {
        status: cart.length > 0 ? 'active' : 'idle',
        lines: cart.map((l) => {
          const displayUnitPrice = displayUnitPriceWithTax(l, activeTaxRate, inclusivePricing)
          return {
            itemName: l.itemName,
            quantity: l.quantity,
            unitPrice: displayUnitPrice,
            lineTotal: displayUnitPrice * l.quantity,
          }
        }),
        subtotal,
        discountTotal: promoDiscount,
        taxTotal,
        totalAmount,
        currency: 'PHP',
      })
    }, 400)
    return () => {
      if (displayTimerRef.current) clearTimeout(displayTimerRef.current)
    }
  }, [sessionId, cart, subtotal, promoDiscount, taxTotal, totalAmount, success])

  // ─── Customer actions ──────────────────────────────────────────────────────

  async function selectCustomer(customer: PosCustomer) {
    setSelectedCustomer(customer)
    setCustomerSearch('')
    setCustomerResults([])
    setCustomerSearchOpen(false)
    setLoyaltyAccount(null)
    setLoyaltyProgram(null)
    setCustomerHistory([])
    setHistoryOpen(false)
    const [loyaltyRes, histRes] = await Promise.all([
      getLoyaltyByCustomer(customer.id),
      getCustomerTransactions(customer.id),
    ])
    if (loyaltyRes.success && loyaltyRes.data) {
      setLoyaltyAccount(loyaltyRes.data)
      const programRes = await getActiveLoyaltyProgram()
      if (programRes.success && programRes.data) setLoyaltyProgram(programRes.data)
    }
    if (histRes.success) setCustomerHistory((histRes.data ?? []).slice(0, 5))
  }

  function clearCustomer() {
    setSelectedCustomer(null)
    setLoyaltyAccount(null)
    setLoyaltyProgram(null)
    setCustomerHistory([])
    setHistoryOpen(false)
    setCustomerSearch('')
  }

  // ─── Cart actions ──────────────────────────────────────────────────────────

  function addToCart(item: LookupItem, qty = 1) {
    // Reserve mode (Scenario 03, Part 3): a SkuReservation is one item +
    // quantity, no serial required — treat every item as plain SKU+qty and
    // cap the cart at a single line (a new pick replaces it, matching this
    // page's no-toast convention of just updating the visible state).
    const isReserveMode = saleMode === 'reserve'
    const lineId = crypto.randomUUID()
    // Every new sale-mode line defaults to WIP — the cashier can switch it
    // per line afterward. Reserve mode never resolves Price Use at all.
    const defaultPriceUseTypeId = isReserveMode
      ? undefined
      : priceUseTypes.find((t) => t.name === 'WIP')?.id
    setCart((prev) => {
      const existing = prev.find((l) => l.itemId === item.id)
      if (existing && !isReserveMode) {
        if (existing.isSerialTracked) {
          // Another physical unit of the same item — a sibling line, not a
          // quantity bump, since it needs its own serial picked separately.
          const siblingLine: CartLine = {
            lineId,
            itemId: item.id,
            itemName: item.name,
            sku: item.sku,
            brandName: item.brandName,
            categoryName: item.category?.name,
            modelNumber: item.modelNumber,
            // This branch only runs when !isReserveMode (see the outer if) —
            // a real sale line, so pricing defers to Price Use, not the
            // catalog's reference price (never show a price before it's
            // actually resolved — that's exactly what the item price cell
            // and the Order Summary total must agree on).
            unitPrice: 0,
            // One payment mode per cart, never per item — a newly added line
            // joins whatever mode the cart is already in.
            invoiceType: cartInvoiceMode,
            quantity: 1,
            taxRate: item.taxRate ?? null,
            uomCode: item.uomCode,
            allowDecimal: item.allowDecimal ?? false,
            pricingMode: item.pricingMode ?? null,
            isSerialTracked: true,
            requiresSecondarySerial: item.requiresSecondarySerial ?? false,
            priceResolved: false,
            priceListItemId: null,
            priceUseTypeId: defaultPriceUseTypeId,
          }
          return [...prev, siblingLine]
        }
        return prev.map((l) =>
          l.itemId === item.id ? { ...l, quantity: parseFloat((l.quantity + qty).toFixed(3)) } : l
        )
      }
      const newLine: CartLine = {
        lineId,
        itemId: item.id,
        itemName: item.name,
        sku: item.sku,
        brandName: item.brandName,
        categoryName: item.category?.name,
        modelNumber: item.modelNumber,
        // Reserve mode never submits as a real sale, so Price Use resolution
        // doesn't apply there — it keeps the catalog reference price. A real
        // sale line starts at 0, not item.price: showing any price before
        // Price Use resolves it would leak the un-resolved reference price
        // into the Order Summary total, same thing the per-line "Select
        // Price Use" placeholder exists to prevent.
        unitPrice: isReserveMode ? item.price : 0,
        // One payment mode per cart, never per item — a newly added line
        // joins whatever mode the cart is already in.
        invoiceType: isReserveMode ? undefined : cartInvoiceMode,
        quantity: isReserveMode ? qty : item.isSerialTracked ? 1 : qty,
        taxRate: item.taxRate ?? null,
        uomCode: item.uomCode,
        allowDecimal: item.allowDecimal ?? false,
        pricingMode: item.pricingMode ?? null,
        isSerialTracked: isReserveMode ? false : (item.isSerialTracked ?? false),
        requiresSecondarySerial: item.requiresSecondarySerial ?? false,
        // Reserve mode never submits as a real sale, so Price Use resolution
        // doesn't apply — treat it as already "resolved" so it never blocks.
        priceResolved: isReserveMode,
        priceListItemId: null,
        priceUseTypeId: defaultPriceUseTypeId,
      }
      return isReserveMode ? [newLine] : [...prev, newLine]
    })
    if (item.isSerialTracked && !isReserveMode) {
      setSerialPickerStage('primary')
      setSerialPickerTarget({
        lineId,
        itemId: item.id,
        itemName: item.name,
        unitPrice: item.price,
        quantity: 1,
        isSerialTracked: true,
        requiresSecondarySerial: item.requiresSecondarySerial ?? false,
      })
    }
  }

  // Cart lines carry mode-specific shape (e.g. addToCart forces
  // isSerialTracked: false while in reserve mode) — a stale cart from a
  // different mode could silently skip serial selection or trip the
  // reserve mode's exactly-one-line check, so switching modes clears it.
  function handleSaleModeChange(mode: 'sale' | 'reserve') {
    if (mode !== saleMode) setCart([])
    setSaleMode(mode)
  }

  // Per-line payment mode (Pay Now/Installment) — switching a line away
  // from installment clears its financing term/down-payment/provider so
  // stale state doesn't linger if it's switched back later; switching away
  // from cash clears its payNowMethod tag the same way.
  // lineIds accepts an array so a displayed row that collapses several
  // physical-unit CartLines (grouped serial-tracked items, same item/qty>1)
  // updates them all together — a customer doesn't split identical units of
  // one item across different payment modes within a single row.
  function setLineInvoiceType(lineIds: string | string[], mode: PosInvoiceType) {
    const ids = new Set(Array.isArray(lineIds) ? lineIds : [lineIds])
    setCart((prev) =>
      prev.map((l) =>
        ids.has(l.lineId)
          ? {
              ...l,
              invoiceType: mode,
              ...(mode !== 'installment'
                ? {
                    financingTermId: undefined,
                    downPaymentInput: undefined,
                    installmentProvider: undefined,
                  }
                : {}),
              ...(mode !== 'cash' ? { payNowMethod: undefined } : {}),
            }
          : l
      )
    )
  }

  // Changing a line's own Price Use just updates the field — the back-fill
  // effect above reacts to the resulting resolution fetch and fills/clears
  // unitPrice/priceListItemId/priceResolved the same way it does on initial
  // add, skipping this line entirely if it already carries a manual
  // priceOverrideBy.
  function setLinePriceUseTypeId(lineIds: string | string[], priceUseTypeId: string) {
    const ids = new Set(Array.isArray(lineIds) ? lineIds : [lineIds])
    setCart((prev) => prev.map((l) => (ids.has(l.lineId) ? { ...l, priceUseTypeId } : l)))
  }

  // Switching an installment line's provider clears whatever the OTHER
  // provider's fields held — inhouse's financingTermId doesn't apply to TPF,
  // and there's nothing for TPF to clear going the other way. The down
  // payment survives the switch in both directions: both providers collect
  // one at the register, under the same 10% floor.
  function setLineInstallmentProvider(lineIds: string | string[], provider: InstallmentProvider) {
    const ids = new Set(Array.isArray(lineIds) ? lineIds : [lineIds])
    setCart((prev) =>
      prev.map((l) => {
        if (!ids.has(l.lineId)) return l
        if (provider !== 'tpf') return { ...l, installmentProvider: provider }
        // TPF has no financing term to pick, so there's no term-selection
        // moment to hang the down-payment pre-fill off the way inhouse does
        // (see setLineFinancingTermId) — seed it here instead, so the panel
        // never opens on a blank field that reads as "nothing to collect".
        const lineAmount = displayUnitPriceWithTax(l, activeTaxRate, inclusivePricing) * l.quantity
        return {
          ...l,
          installmentProvider: provider,
          financingTermId: undefined,
          downPaymentInput: l.downPaymentInput ?? Math.ceil(0.1 * lineAmount).toFixed(2),
        }
      })
    )
  }

  function setLineFinancingTermId(lineIds: string | string[], financingTermId: string) {
    const ids = new Set(Array.isArray(lineIds) ? lineIds : [lineIds])
    setCart((prev) =>
      prev.map((l) => {
        if (!ids.has(l.lineId)) return l
        // Pre-fill the down payment as soon as a term is picked (never
        // overwriting a value the cashier already typed) — otherwise the
        // cart sits at a blank/0 down payment that reads as "nothing to
        // collect" but can't actually be submitted that way. Scenario 15,
        // Part 5 — a curated per-SKU down payment from the real NIG rate
        // card wins over the generic 10%-floor fallback when one exists.
        if (l.downPaymentInput) return { ...l, financingTermId }
        const downPaymentInput =
          l.priceListDownPayment != null
            ? Number(l.priceListDownPayment).toFixed(2)
            : // Whole pesos, rounded UP — never centavos, and never below the
              // 10% floor (ceil instead of round guarantees that even if the
              // exact 10% has a fractional remainder).
              Math.ceil(
                displayUnitPriceWithTax(l, activeTaxRate, inclusivePricing) * l.quantity * 0.1
              ).toFixed(2)
        return { ...l, financingTermId, downPaymentInput }
      })
    )
  }

  function setLineDownPaymentInput(lineIds: string | string[], downPaymentInput: string) {
    const ids = new Set(Array.isArray(lineIds) ? lineIds : [lineIds])
    setCart((prev) => prev.map((l) => (ids.has(l.lineId) ? { ...l, downPaymentInput } : l)))
  }

  function toggleDownPaymentEdit(lineId: string) {
    setDownPaymentEditOpen((prev) => ({ ...prev, [lineId]: !prev[lineId] }))
  }

  function setQty(itemId: string, qty: number) {
    const line = cart.find((l) => l.itemId === itemId)
    if (line?.isSerialTracked) {
      if (qty < 1) removeFromCart(itemId)
      return
    }
    const min = line?.allowDecimal ? 0.001 : 1
    if (qty < min) {
      removeFromCart(itemId)
      return
    }
    setCart((prev) => prev.map((l) => (l.itemId === itemId ? { ...l, quantity: qty } : l)))
  }

  function removeFromCart(itemId: string) {
    setCart((prev) => prev.filter((l) => l.itemId !== itemId))
  }

  function removeCartLine(lineId: string) {
    setCart((prev) => prev.filter((l) => l.lineId !== lineId))
  }

  // Multiple serial-tracked units of the same item are grouped into one
  // cart row (see displayGroups) — its stepper adds/removes a whole line
  // at a time (each unit needs its own serial), rather than adjusting a
  // single line's quantity number the way non-serial items do.
  function addUnitOfItem(itemId: string) {
    const template = cart.find((l) => l.itemId === itemId)
    if (!template) return
    const siblingLine: CartLine = {
      ...template,
      lineId: crypto.randomUUID(),
      serialNumberId: undefined,
      serialNumberLabel: undefined,
      secondarySerialNumberId: undefined,
      secondarySerialNumberLabel: undefined,
    }
    setCart((prev) => [...prev, siblingLine])
    setSerialPickerStage('primary')
    setSerialPickerTarget(siblingLine)
  }

  function removeLastUnitOfItem(itemId: string) {
    setCart((prev) => {
      for (let i = prev.length - 1; i >= 0; i--) {
        if (prev[i].itemId === itemId) return prev.filter((_, idx) => idx !== i)
      }
      return prev
    })
  }

  // ─── Promo actions ─────────────────────────────────────────────────────────

  async function applyPromo() {
    if (!promoInput.trim()) return
    setPromoError('')
    setValidatingPromo(true)
    const res = await validatePromoCode({
      code: promoInput.trim().toUpperCase(),
      orderTotal: rawSubtotal,
      itemIds: cart.map((l) => l.itemId),
    })
    setValidatingPromo(false)
    if (!res.success) {
      setPromoError(res.error ?? 'Validation failed')
      return
    }
    if (!res.data?.valid) {
      setPromoError(res.data?.message ?? 'Invalid promo code')
      return
    }
    setPromoResult(res.data)
  }

  function clearPromo() {
    setPromoResult(null)
    setPromoInput('')
    setPromoError('')
    setManagerOverrideApproved(false)
    setOverrideManagerName('')
  }

  async function handleManagerOverride() {
    setOverrideError('')
    if (!overridePin.trim()) {
      setOverrideError("Enter the manager's PIN.")
      return
    }
    setOverridePending(true)
    const res = await validateManagerByPin(overridePin.trim())
    setOverridePending(false)
    if (!res.success || !res.data) {
      setOverrideError(res.error ?? 'Override failed')
      return
    }
    setManagerOverrideApproved(true)
    setOverrideManagerId(res.data.managerId)
    setOverrideManagerName(res.data.managerName ?? 'Manager')
    setShowOverrideDialog(false)
    setOverridePin('')
    setOverrideError('')
  }

  // A price override reuses the same shared managerOverride/managerUserId
  // slot the submission payload sends for discount overrides — the backend
  // treats "PIN-approved on this sale" as one sale-level fact regardless of
  // which line it applies to (same limitation the existing discount-override
  // system already has for multi-line, multi-approver sales).
  function handlePriceOverrideApprove(
    lineId: string,
    result: { managerId: string; managerName: string; newPrice: number }
  ) {
    setCart((prev) =>
      prev.map((l) =>
        l.lineId === lineId
          ? {
              ...l,
              unitPrice: result.newPrice,
              priceOverrideBy: result.managerId,
              priceOverrideApproverName: result.managerName,
              priceResolved: true,
              priceListItemId: null,
              priceListDownPayment: null,
            }
          : l
      )
    )
    setManagerOverrideApproved(true)
    setOverrideManagerId(result.managerId)
    setOverrideManagerName(result.managerName)
    setPriceOverrideTargetLineId(null)
  }

  // ─── Payment actions ───────────────────────────────────────────────────────

  // Scenario 37 — a new payment row defaults to whatever Item Payment Mode
  // already decided (Credit Card → card; Cash's own sub-choice → cash/
  // bank_transfer/qr), so the cashier isn't asked to re-pick a method that
  // was already chosen above. Still just a default — freely changeable via
  // the row's own dropdown for split-tender or anything else.
  function preferredPaymentMethodKey(): PosPaymentMethod | null {
    if (hasCreditCardLine) return 'card'
    if (hasCashLine) {
      return cashSubMode === 'cash_on_hand'
        ? 'cash'
        : cashSubMode === 'bank_transfer'
          ? 'bank_transfer'
          : 'qr'
    }
    return null
  }

  function addPaymentRow() {
    if (configuredMethods.length > 0) {
      const eligible = configuredMethods.filter((m) => {
        if (isOffline) return m.key === 'cash'
        return m.key === null
          ? enabledPaymentMethods.includes('custom')
          : enabledPaymentMethods.includes(m.key as PosPaymentMethod)
      })
      const preferredKey = preferredPaymentMethodKey()
      const preferred = preferredKey ? eligible.find((m) => m.key === preferredKey) : undefined
      const first = preferred ?? eligible[0]
      if (first) {
        setPayments((prev) => [
          ...prev,
          {
            method:
              first.type === 'custom' ? 'custom' : ((first.key as PosPaymentMethod) ?? 'custom'),
            amount: 0,
            referenceNumber: '',
            configId: first.id,
            refFieldLabel: first.referenceFieldLabel ?? undefined,
            refRequired: first.referenceIsRequired,
            refRegex: first.referenceFieldRegex ?? undefined,
          },
        ])
        return
      }
    }
    const preferredKey = preferredPaymentMethodKey()
    const defaultMethod = isOffline ? 'cash' : (preferredKey ?? enabledPaymentMethods[0] ?? 'cash')
    setPayments((prev) => [...prev, { method: defaultMethod, amount: 0, referenceNumber: '' }])
  }

  function updatePayment(idx: number, patch: Partial<PaymentRow>) {
    setPayments((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)))
  }

  function removePaymentRow(idx: number) {
    setPayments((prev) => prev.filter((_, i) => i !== idx))
  }

  // ─── Park sale ─────────────────────────────────────────────────────────────

  async function handleParkSale() {
    if (!parkLabel.trim() || cart.length === 0) return
    const session = openSessions.find((s) => s.id === sessionId)
    if (!session) {
      setError('Select a session first.')
      return
    }
    setParking(true)
    const res = await parkSale({
      sessionId: session.id,
      terminalId: session.terminalId,
      label: parkLabel.trim(),
      cartData: {
        lines: cart,
        customerId: selectedCustomer?.id,
        promoCodeId: promoResult?.promoCode?.id,
      },
    })
    setParking(false)
    if (!res.success) {
      setError(res.error ?? 'Failed to park sale')
      return
    }
    setCart([])
    setSelectedCustomer(null)
    setLoyaltyAccount(null)
    setLoyaltyProgram(null)
    setCustomerHistory([])
    setHistoryOpen(false)
    setPromoResult(null)
    setPromoInput('')
    setPayments([])
    setShowParkModal(false)
    setParkLabel('')
  }

  // ─── Confirm sale ──────────────────────────────────────────────────────────

  async function handleConfirm() {
    if (!sessionId) {
      setError('Select an open session first.')
      return
    }
    if (cart.length === 0) {
      setError('Cart is empty.')
      return
    }

    // Reserve mode never creates a PosTransaction — its own submit path,
    // bypassing every transaction-specific check/branch below.
    if (saleMode === 'reserve') {
      return handleConfirmReserve()
    }

    const anySerialMissing = cart.some(
      (l) =>
        (l.isSerialTracked && !l.serialNumberId) ||
        (l.requiresSecondarySerial && !l.secondarySerialNumberId)
    )
    if (anySerialMissing) {
      setError('Select serial numbers for every serialized item to continue.')
      return
    }
    if (cart.some((l) => !l.priceUseTypeId)) {
      setError('Select a Price Use for every item before checking out.')
      return
    }
    if (cart.some((l) => !l.priceResolved)) {
      setError(
        'One or more items have no price for their selected Price Use — set an override price for them or pick a different Price Use.'
      )
      return
    }
    if (needsManagerOverride && !managerOverrideApproved) {
      setError('This discount needs a manager override before checking out.')
      return
    }

    if (isTaxExempt && !taxExemptionRef.trim()) {
      setError('Enter a certificate or exemption reference for tax-exempt sales.')
      return
    }

    if (hasChargeOrInstallmentLine) {
      if (!selectedCustomer) {
        setError('A customer must be selected — this cart has a charge or installment item.')
        return
      }
      if (isOffline) {
        setError('Charge and installment items require an active network connection.')
        return
      }
    } else if (!selectedCustomer) {
      setError('A customer must be selected before completing a sale.')
      return
    }

    const lineMissingTerm = inhouseInstallmentCartLines.find((l) => !l.financingTermId)
    if (lineMissingTerm) {
      setError(`Select a financing term for ${lineMissingTerm.itemName}.`)
      return
    }
    if (inhouseInstallmentCartLines.length > 0 && !creditApplicationId) {
      setError(
        'Select the approved credit application for this customer — every installment sale requires one.'
      )
      return
    }
    if (tpfInstallmentCartLines.length > 0) {
      if (!tpfProviderId) {
        setError('Select a TPF provider for the TPF-financed item(s).')
        return
      }
      if (!tpfReferenceNumber.trim()) {
        setError("Enter the financier's reference number for the TPF-financed item(s).")
        return
      }
      // Same 10% floor as inhouse — the financier funds only the balance,
      // so a missing down payment isn't "financed in full", it's unbilled.
      for (const l of tpfInstallmentCartLines) {
        const lineAmount = displayUnitPriceWithTax(l, activeTaxRate, inclusivePricing) * l.quantity
        const downPayment = parseFloat(l.downPaymentInput ?? '0') || 0
        if (downPayment <= 0) {
          setError(`${l.itemName} needs a down payment — TPF sales still collect one at checkout.`)
          return
        }
        if (downPayment > lineAmount) {
          setError(`${l.itemName}'s down payment must be between 0 and its sale amount.`)
          return
        }
        if (downPayment < 0.1 * lineAmount - 0.005) {
          setError(`${l.itemName}'s down payment must be at least 10% of its sale amount.`)
          return
        }
      }
    }
    for (const l of inhouseInstallmentCartLines) {
      const lineAmount = displayUnitPriceWithTax(l, activeTaxRate, inclusivePricing) * l.quantity
      const downPayment = parseFloat(l.downPaymentInput ?? '0') || 0
      if (downPayment < 0 || downPayment > lineAmount) {
        setError(`${l.itemName}'s down payment must be between 0 and its sale amount.`)
        return
      }
      // 0.005 (half a centavo) tolerance absorbs float noise from the
      // tax-inclusive/exclusive price conversion above — without it, typing
      // the exact rounded-to-centavo value shown by the "Min" hint below
      // can land a hair under the true unrounded floor and be rejected.
      if (downPayment < 0.1 * lineAmount - 0.005) {
        setError(`${l.itemName}'s down payment must be at least 10% of its sale amount.`)
        return
      }
    }

    // Down payment — forced explicit choice before its amount can even be
    // tendered, same as before the down payment shared this pool.
    if (installmentCartLines.length > 0 && !installmentPaymentMethod) {
      setError('Choose how the down payment will be paid — Cash or Credit/Debit Card.')
      return
    }

    if (tenderTarget > 0) {
      if (payments.length === 0) {
        setError('Add at least one payment method.')
        return
      }
      if (balance > 0.009) {
        setError(`Underpaid by ${fmt(balance)}.`)
        return
      }
      if (isOffline && payments.some((p) => p.amount > 0 && p.method !== 'cash')) {
        setError('Only cash payments are accepted while offline.')
        return
      }
      // CR Number (collection receipt) is required on every row whenever
      // this sale has an inhouse installment/down-payment component — it
      // doubles as the receipt/CR number issued at the time the down
      // payment is collected, so plain cash isn't exempt the way it is
      // elsewhere. A plain sale still needs a reference for card/bank/
      // e-wallet/etc. (REF_METHODS), just not for plain cash.
      const missingRef = payments.find(
        (p) =>
          p.amount > 0 &&
          !p.referenceNumber.trim() &&
          (inhouseInstallmentCartLines.length > 0 || REF_METHODS.includes(p.method))
      )
      if (missingRef) {
        setError(`CR Number is required for ${PAYMENT_LABELS[missingRef.method]}.`)
        return
      }
      if (deliveryFeeAmount > 0 && !deliveryFeeReferenceNumberInput.trim()) {
        setError('Delivery Fee Reference is required.')
        return
      }
      const cardPaymentPending = payments.some((p) => p.method === 'card' && p.amount > 0)
      if (cardPaymentPending && cardTxnMode === 'installment' && !cardInstallmentTerm) {
        setError('Select a Term for the card installment payment (Payment Mode).')
        return
      }
    }

    if (loyaltyOverBalance && loyaltyAccount) {
      const maxPhp = loyaltyAccount.currentPoints * loyaltyPointsValue
      setError(
        `Insufficient loyalty points — have ${loyaltyAccount.currentPoints} pts (≈ ${fmt(maxPhp)}).`
      )
      return
    }

    // Offline: buffer to localStorage and show success
    if (isOffline) {
      const offlineTx: SyncTransactionItem = {
        isOfflineSynced: true,
        sessionId,
        transactionType: 'sale',
        customerId: selectedCustomer?.id,
        promoCodeId: promoResult?.promoCode?.id,
        discountAmount: promoDiscount,
        taxAmount: taxTotal,
        subtotal: vatExclSubtotalForBackend,
        totalAmount: grandTotalWithFee,
        deliveryFee: deliveryFeeAmount || undefined,
        deliveryFeeReferenceNumber: deliveryFeeReferenceNumberInput.trim() || undefined,
        isTaxExempt,
        taxExemptionRef: isTaxExempt ? taxExemptionRef : undefined,
        offlinePaymentMethods: payments.filter((p) => p.amount > 0).map((p) => p.method),
        lines: cart.map((l) => ({
          itemId: l.itemId,
          itemName: l.itemName,
          sku: l.sku,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          discountAmount: 0,
          taxAmount: lineTaxAmount(l, activeTaxRate, inclusivePricing),
          pricingMode: l.pricingMode ?? undefined,
          priceUseTypeId: l.priceUseTypeId ?? undefined,
        })),
      }
      const raw = localStorage.getItem(OFFLINE_QUEUE_KEY)
      const queue: SyncTransactionItem[] = raw ? JSON.parse(raw) : []
      queue.push(offlineTx)
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue))
      setSuccess({
        transactionId: '',
        transactionNumber: `OFFLINE-${Date.now()}`,
        change,
        loyaltyEarned: false,
        offlineBuffered: true,
        lineOutcomes: [],
      })
      return
    }

    setError('')
    setSubmitting(true)

    try {
      let txId = ''
      let txData: PosTransaction | null = null

      if (fromTab?.posTransactionId) {
        txId = fromTab.posTransactionId
      } else {
        const txRes = await createTransaction({
          sessionId,
          transactionType: 'sale',
          // No transaction-level invoiceType/financingTermId/downPayment/
          // priceUseTypeId — every line below sends its own explicit value,
          // so the backend's transaction-level fallback (for older/other
          // callers) never needs to apply here.
          creditApplicationId:
            inhouseInstallmentCartLines.length > 0 ? creditApplicationId : undefined,
          tpfProviderId: tpfInstallmentCartLines.length > 0 ? tpfProviderId : undefined,
          tpfReferenceNumber: tpfInstallmentCartLines.length > 0 ? tpfReferenceNumber : undefined,
          tpfApprovedAmount:
            tpfInstallmentCartLines.length > 0 && tpfApprovedAmount
              ? parseFloat(tpfApprovedAmount)
              : undefined,
          // Which register account the TPF down payment debits — the same
          // Cash/Debit-Credit choice (and Cash's own sub-mode) the cashier
          // made for the down payment above, not a separate control.
          tpfDownPaymentMethod:
            tpfInstallmentCartLines.length > 0
              ? ((preferredPaymentMethodKey() ?? 'cash') as
                  | 'cash'
                  | 'card'
                  | 'bank_transfer'
                  | 'qr')
              : undefined,
          customerId: selectedCustomer?.id,
          promoCodeId: promoResult?.promoCode?.id,
          discountAmount: promoDiscount,
          taxAmount: taxTotal,
          subtotal: vatExclSubtotalForBackend,
          totalAmount: grandTotalWithFee,
          deliveryFee: deliveryFeeAmount || undefined,
          deliveryFeeReferenceNumber: deliveryFeeReferenceNumberInput.trim() || undefined,
          isTaxExempt,
          taxExemptionRef: isTaxExempt ? taxExemptionRef : undefined,
          managerOverride: managerOverrideApproved || undefined,
          managerUserId: managerOverrideApproved ? overrideManagerId : undefined,
          allowNegativeStock: allowNegativeStock || undefined,
          lines: cart.map((l) => ({
            itemId: l.itemId,
            itemName: l.itemName,
            sku: l.sku,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            discountAmount: 0,
            taxAmount: lineTaxAmount(l, activeTaxRate, inclusivePricing),
            pricingMode: l.pricingMode ?? undefined,
            serialNumberId: l.serialNumberId,
            secondarySerialNumberId: l.secondarySerialNumberId,
            priceListItemId: l.priceListItemId ?? undefined,
            priceUseTypeId: l.priceUseTypeId ?? undefined,
            priceOverride: l.priceOverrideBy ? true : undefined,
            invoiceType: l.invoiceType ?? 'cash',
            installmentProvider:
              l.invoiceType === 'installment' ? l.installmentProvider : undefined,
            payNowMethod: (l.invoiceType ?? 'cash') === 'cash' ? l.payNowMethod : undefined,
            financingTermId:
              l.invoiceType === 'installment' && l.installmentProvider !== 'tpf'
                ? l.financingTermId
                : undefined,
            // Both providers collect one — inhouse's funds its schedule,
            // TPF's is simply the slice the financier doesn't fund.
            downPayment:
              l.invoiceType === 'installment'
                ? parseFloat(l.downPaymentInput ?? '0') || 0
                : undefined,
          })),
        })

        if (!txRes.success || !txRes.data) {
          const rawMsg = txRes.error ?? txRes.message ?? 'Failed to create transaction.'
          const idToName = Object.fromEntries(cart.map((l) => [l.itemId, l.itemName]))
          const errMsg = rawMsg.replace(
            /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
            (uuid) => idToName[uuid] ?? uuid
          )

          // Backend has no dedicated error code yet for a serial that was reserved or
          // sold from under the cashier — detect it by message content defensively and
          // send them straight back to the picker instead of a dead-end error banner.
          if (errMsg.toLowerCase().includes('no longer available')) {
            const serialLines = cart.filter((l) => l.isSerialTracked && l.serialNumberId)
            const stale =
              serialLines.find(
                (l) =>
                  l.serialNumberLabel &&
                  errMsg.toLowerCase().includes(l.serialNumberLabel.toLowerCase())
              ) ?? serialLines[0]

            if (stale) {
              setCart((prev) =>
                prev.map((l) =>
                  l.lineId === stale.lineId
                    ? { ...l, serialNumberId: undefined, serialNumberLabel: undefined }
                    : l
                )
              )
              setError(
                `${stale.itemName}'s serial number is no longer available — please select another.`
              )
              setSubmitting(false)
              setSerialPickerTarget({
                lineId: stale.lineId,
                itemId: stale.itemId,
                itemName: stale.itemName,
                unitPrice: stale.unitPrice,
                quantity: stale.quantity,
                isSerialTracked: true,
              })
              return
            }
          }

          setError(errMsg)
          setSubmitting(false)
          return
        }

        // Serial-tracked line in the cart — backend deferred to manager approval
        // instead of completing the sale. Show the pending screen and bail out
        // before any payment/loyalty steps run (there is no transaction yet).
        if (isPendingApproval(txRes.data)) {
          const { releaseFormRequestId } = txRes.data
          const serialLines = cart
            .filter((l) => l.isSerialTracked)
            .map((l) => ({ itemName: l.itemName, serialNumberLabel: l.serialNumberLabel }))
          // A charge/installment sale can reach pending-approval with zero
          // serial-tracked lines (that's not just a serialized-item flow
          // anymore) — fall back to describing/listing the cart itself
          // rather than producing a nonsensical "0 serial-tracked items"
          // label and an empty line-items area on the pending screen.
          const displayLines =
            serialLines.length > 0
              ? serialLines
              : cart.map((l) => ({
                  itemName: l.itemName,
                  serialNumberLabel: `×${l.quantity}`,
                }))

          updateSessionDisplay(sessionId, {
            status: 'idle',
            lines: [],
            subtotal: 0,
            discountTotal: 0,
            taxTotal: 0,
            totalAmount: 0,
            currency: 'PHP',
          })

          setSubmitting(false)
          setPendingApproval({
            releaseFormRequestId,
            totalAmount: grandTotalWithFee,
            serialLines: displayLines,
            creditApplicationId:
              inhouseInstallmentCartLines.length > 0 ? creditApplicationId : undefined,
          })
          return
        }

        // Defensive — checkout only ever submits transactionType: 'sale', so the
        // backend should never defer here (that's the refund-specific path, which
        // lives on the Transactions page, not checkout). Narrows the type for the
        // PosTransaction access below.
        if (isRefundPendingApproval(txRes.data)) {
          setError('Unexpected response from server.')
          setSubmitting(false)
          return
        }

        txId = txRes.data.id
        txData = txRes.data
      }

      if (tenderTarget > 0) {
        // The merged payments pool covers cash/TPF + delivery fee first,
        // then whatever's left over goes to the down payment below — same
        // rows can straddle both if the cashier tendered it all in one go.
        const rows = payments.filter((p) => p.amount > 0)
        const consumed: number[] = rows.map(() => 0)
        const payRowPortion = async (
          row: PaymentRow,
          amount: number,
          installmentScheduleId?: string
        ) => {
          const payRes = await addPayment(txId, {
            paymentMethod: row.method,
            amount,
            referenceNumber: row.referenceNumber || undefined,
            paymentMethodConfigId: row.configId,
            // Scenario 37 — card's terminal/txn-mode/term, and bank_transfer/qr's
            // bank/gateway, all come from the Payment Method toggle's
            // transaction-scoped state now, not this row.
            paymentMethodOptionId:
              row.method === 'card'
                ? cardTerminalOptionId
                : row.method === 'bank_transfer' || row.method === 'qr'
                  ? cashPaymentOptionId
                  : row.paymentMethodOptionId,
            cardTxnMode: row.method === 'card' ? cardTxnMode : undefined,
            cardInstallmentTerm: row.method === 'card' ? cardInstallmentTerm : undefined,
            bankTransferVerifiedAtRegister:
              row.method === 'bank_transfer' ? bankTransferVerifiedAtRegister : undefined,
            installmentScheduleId,
          })
          if (!payRes.success) {
            const isRefFail =
              payRes.error?.includes('REFERENCE_VALIDATION_FAILED') ||
              payRes.error?.toLowerCase().includes('reference validation')
            const label = row.refFieldLabel ?? PAYMENT_LABELS[row.method] ?? 'Reference'
            setError(
              isRefFail
                ? `Invalid ${label} format — please check the value and try again.`
                : installmentScheduleId
                  ? `Transaction created but the down payment failed: ${payRes.error}`
                  : `Transaction created but payment failed: ${payRes.error}`
            )
            setSubmitting(false)
            return false
          }
          return true
        }

        let remaining = regularTenderTarget
        for (let i = 0; i < rows.length && remaining > 0.009; i++) {
          const take = parseFloat(Math.min(rows[i].amount, remaining).toFixed(2))
          if (take <= 0) continue
          if (!(await payRowPortion(rows[i], take))) return
          consumed[i] = take
          remaining = parseFloat((remaining - take).toFixed(2))
        }

        // Down payment: tagged to its own installment schedule instead of
        // being pooled as a plain sale payment. A cart can have more than
        // one schedule (distinct financing terms) even though the cashier
        // only picked one payment method for the whole sale, so whatever's
        // left of each row (after the regular target above) is greedily
        // split across each schedule's own downPayment amount, in order —
        // same technique as the backend's own allocatePayments, just scoped
        // to distributing same-method-family rows across schedules, never
        // mixing methods.
        if (installmentDownPaymentsTotal > 0 && txData?.installmentSchedules) {
          const leftover = (i: number) => parseFloat((rows[i].amount - consumed[i]).toFixed(2))
          let rowIdx = 0
          while (rowIdx < rows.length && leftover(rowIdx) <= 0.009) rowIdx++
          let remainingInRow = rowIdx < rows.length ? leftover(rowIdx) : 0
          for (const schedule of txData.installmentSchedules) {
            let need = Number(schedule.downPayment)
            while (need > 0.009 && rowIdx < rows.length) {
              const row = rows[rowIdx]
              const take = parseFloat(Math.min(need, remainingInRow).toFixed(2))
              if (take > 0.009) {
                if (!(await payRowPortion(row, take, schedule.id))) return
              }
              need -= take
              remainingInRow -= take
              if (remainingInRow <= 0.009) {
                rowIdx += 1
                while (rowIdx < rows.length && leftover(rowIdx) <= 0.009) rowIdx++
                remainingInRow = rowIdx < rows.length ? leftover(rowIdx) : 0
              }
            }
          }
        }
      }

      // Redeem loyalty points if that method was used
      if (loyaltyPaymentRow && loyaltyPaymentRow.amount > 0 && loyaltyAccount) {
        const pointsToRedeem = Math.max(
          1,
          Math.round(loyaltyPaymentRow.amount / loyaltyPointsValue)
        )
        const redeemRes = await redeemPoints(loyaltyAccount.id, {
          points: pointsToRedeem,
          orderTotal: regularTenderTarget - deliveryFeeAmount,
          posTransactionId: txId,
        })
        if (!redeemRes.success) {
          setError(`Payment recorded but loyalty redemption failed: ${redeemRes.error}`)
          setSubmitting(false)
          return
        }
      }

      // Earn loyalty points — silent fail. Points accrue on everything
      // actually collected today, cash/TPF and down payment alike.
      let loyaltyEarned = false
      if (loyaltyAccount) {
        try {
          // The delivery fee is a cost pass-through, not a purchase amount —
          // excluded from what earns points, same reasoning as the redeem
          // orderTotal above.
          const collectedToday = tenderTarget - deliveryFeeAmount
          const pointsEarned = Math.floor(collectedToday * (loyaltyProgram?.pointsPerUnit ?? 1))
          const earnRes = await earnPoints(loyaltyAccount.id, {
            points: pointsEarned,
            transactionAmount: collectedToday,
            posTransactionId: txId,
          })
          loyaltyEarned = !!earnRes.success
        } catch {
          // intentionally swallowed
        }
      }

      if (fromTab) {
        localStorage.removeItem(POS_FROM_TAB_KEY)
      }

      // Clear the customer display
      updateSessionDisplay(sessionId, {
        status: 'idle',
        lines: [],
        subtotal: 0,
        discountTotal: 0,
        taxTotal: 0,
        totalAmount: 0,
        currency: 'PHP',
      })

      setSubmitting(false)
      setSuccess({
        transactionId: txId,
        transactionNumber: txData?.transactionNumber ?? txId,
        change,
        journalEntryId: txData?.journalEntryId,
        arInvoiceId: txData?.arInvoiceId ?? null,
        salesInvoiceNumber: txData?.salesInvoiceNumber ?? null,
        deliveryReceiptNumber: txData?.deliveryReceiptNumber ?? null,
        loyaltyEarned,
        invoices: txData?.invoices ?? [],
        lineOutcomes: cart.map((l) => ({
          lineId: l.lineId,
          itemName: l.itemName,
          invoiceType: l.invoiceType ?? 'cash',
          installmentProvider:
            l.invoiceType === 'installment' ? (l.installmentProvider ?? 'inhouse') : null,
          installmentPreview:
            l.invoiceType === 'installment' && l.installmentProvider !== 'tpf'
              ? (installmentPreviews[l.lineId] ?? null)
              : null,
          downPayment:
            l.invoiceType === 'installment' && l.installmentProvider === 'tpf'
              ? parseFloat(l.downPaymentInput ?? '0') || 0
              : null,
          financedBalance:
            l.invoiceType === 'installment' && l.installmentProvider === 'tpf'
              ? Math.max(
                  0,
                  displayUnitPriceWithTax(l, activeTaxRate, inclusivePricing) * l.quantity -
                    (parseFloat(l.downPaymentInput ?? '0') || 0)
                )
              : null,
        })),
      })
    } catch (err) {
      console.error('[POS] handleConfirm error:', err)
      setError('An unexpected error occurred. Please try again.')
      setSubmitting(false)
    }
  }

  function resetSale() {
    setCart([])
    setSelectedCustomer(null)
    setLoyaltyAccount(null)
    setLoyaltyProgram(null)
    setCustomerHistory([])
    setHistoryOpen(false)
    setCustomerSearch('')
    setPromoInput('')
    setPromoResult(null)
    setPromoError('')
    setPayments([])
    setError('')
    setSuccess(null)
    setPendingApproval(null)
    setReservationSuccess(null)
    setIsTaxExempt(false)
    setTaxExemptionRef('')
    setDeliveryFeeReferenceNumberInput('')
    setSearchQuery('')
    setManagerOverrideApproved(false)
    setOverrideManagerName('')
    setPriceOverrideTargetLineId(null)
    setFromTab(null)
    setSaleMode('sale')
    setTpfProviderId('')
    setTpfReferenceNumber('')
    setTpfApprovedAmount('')
    setInstallmentPreviews({})
    setInstallmentPreviewErrors({})
    setInstallmentPreviewLoading({})
    localStorage.removeItem(POS_FROM_TAB_KEY)
    setCancellationReqId(null)
    if (cancellationPollRef.current) {
      clearInterval(cancellationPollRef.current)
      cancellationPollRef.current = null
    }
  }

  // Scenario 03, Part 3 — Reserve mode's own submit path. Creates a
  // SkuReservation (one item + quantity, no serial) and, only if a nonzero
  // amount was entered in the Payment card, a CustomerAdvance deposit
  // against it. Never touches /pos/transactions at all.
  async function handleConfirmReserve() {
    if (!selectedCustomer) {
      setError('A customer must be selected to reserve an item.')
      return
    }
    if (cart.length !== 1) {
      setError('Reserve one item at a time.')
      return
    }
    const line = cart[0]
    if (!(line.quantity > 0)) {
      setError('Enter a quantity greater than zero.')
      return
    }
    if (totalPaid > reserveValue + 0.01) {
      setError(
        `Deposit (${fmt(totalPaid)}) cannot exceed the reservation's value (${fmt(reserveValue)}).`
      )
      return
    }
    const missingRef = payments.find(
      (p) => REF_METHODS.includes(p.method) && p.amount > 0 && !p.referenceNumber.trim()
    )
    if (missingRef) {
      setError(`Reference number is required for ${PAYMENT_LABELS[missingRef.method]}.`)
      return
    }
    const cardDepositPending = payments.some((p) => p.method === 'card' && p.amount > 0)
    if (cardDepositPending && cardTxnMode === 'installment' && !cardInstallmentTerm) {
      setError('Select a Term for the card installment payment (Payment Mode).')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const resResult = await createSkuReservation({
        itemId: line.itemId,
        customerId: selectedCustomer.id,
        quantity: line.quantity,
      })
      if (!resResult.success || !resResult.data) {
        setError(resResult.error || 'Failed to create reservation.')
        return
      }
      const reservation = resResult.data

      let depositAmount = 0
      const firstPaidRow = payments.find((p) => p.amount > 0)
      if (totalPaid > 0 && firstPaidRow) {
        const advResult = await createCustomerAdvance({
          customerId: selectedCustomer.id,
          amount: totalPaid,
          referenceType: 'sku_reservation',
          referenceId: reservation.id,
          paymentMethod: firstPaidRow.method,
        })
        if (!advResult.success || !advResult.data) {
          // The reservation itself succeeded — don't lose it. Surface the
          // deposit failure distinctly so the cashier knows to retry just
          // the deposit, not the whole reservation.
          setError(
            `Reservation created (ref ${reservation.id.slice(0, 8)}), but recording the deposit failed: ${advResult.error || 'unknown error'}. The reservation stands — record the deposit separately.`
          )
          return
        }
        depositAmount = advResult.data.amount
      }

      setReservationSuccess({
        reservationId: reservation.id,
        itemName: line.itemName,
        quantity: line.quantity,
        customerName: customerDisplayName(selectedCustomer),
        depositAmount,
      })
    } catch {
      setError('Failed to create reservation.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRequestCancellation() {
    if (!cancelReason.trim()) {
      setCancelError('Grounds for cancellation are required.')
      return
    }
    setCancelSubmitting(true)
    setCancelError('')
    const snapshot = cart.map((l) => ({
      itemId: l.itemId,
      itemName: l.itemName,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
    }))
    const res = await submitCancellationRequest(sessionId, {
      reason: cancelReason.trim(),
      cartSnapshot: snapshot,
    })
    setCancelSubmitting(false)
    if (!res.success || !res.data) {
      setCancelError(res.error ?? 'Failed to submit cancellation request.')
      return
    }
    setCancellationReqId(res.data.id)
    setShowCancelModal(false)
    setCancelReason('')
  }

  useEffect(() => {
    if (!cancellationReqId) return
    cancellationPollRef.current = setInterval(async () => {
      const res = await getCancellationRequestStatus(cancellationReqId)
      if (!res.success || !res.data) return
      if (res.data.status === 'approved') {
        clearInterval(cancellationPollRef.current!)
        cancellationPollRef.current = null
        resetSale()
      } else if (res.data.status === 'rejected') {
        clearInterval(cancellationPollRef.current!)
        cancellationPollRef.current = null
        setCancellationReqId(null)
        setError('Cancellation was rejected by the manager. You may continue the sale.')
      }
    }, 5000)
    return () => {
      if (cancellationPollRef.current) clearInterval(cancellationPollRef.current)
    }
  }, [cancellationReqId])

  // ─── Success screen ────────────────────────────────────────────────────────

  if (success) {
    return (
      <SuccessScreen
        success={success}
        totalAmount={grandTotalWithFee}
        selectedCustomer={selectedCustomer}
        onReset={resetSale}
        fmt={fmt}
        customerDisplayName={customerDisplayName}
        cart={cart}
        payments={payments}
        promoDiscount={promoDiscount}
        activeTaxRate={activeTaxRate}
        inclusivePricing={inclusivePricing}
      />
    )
  }

  if (pendingApproval) {
    return (
      <PendingApprovalScreen
        releaseFormRequestId={pendingApproval.releaseFormRequestId}
        totalAmount={pendingApproval.totalAmount}
        serialLines={pendingApproval.serialLines}
        creditApplicationId={pendingApproval.creditApplicationId}
        canSignPromissoryNote={canSignPromissoryNote}
        onReset={resetSale}
        fmt={fmt}
      />
    )
  }

  if (reservationSuccess) {
    return (
      <ReserveSuccessScreen reservationSuccess={reservationSuccess} onReset={resetSale} fmt={fmt} />
    )
  }

  // ─── No open sessions ──────────────────────────────────────────────────────

  if (sessionsData && openSessions.length === 0) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-4 bg-zinc-50 p-10">
        <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border border-amber-100 bg-white p-8 text-center shadow-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-50">
            <AlertTriangle size={28} className="text-amber-500" />
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900">No Open Session</p>
            <p className="mt-1 text-sm text-gray-500">
              You need an active cashier session before you can process sales.
            </p>
          </div>
          <a
            href="/pos/sessions"
            className="w-full rounded-xl bg-purple-700 py-3 text-center text-sm font-bold text-white hover:bg-purple-800"
          >
            Open a Session
          </a>
        </div>
      </div>
    )
  }

  const activeSession = openSessions.find((s) => s.id === sessionId)

  // ─── Main layout ───────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col overflow-hidden bg-zinc-50">
      {/* Offline banner */}
      {isOffline && (
        <div className="flex items-center gap-2 bg-amber-500 px-5 py-2 text-sm font-medium text-white">
          <WifiOff size={14} />
          Offline — only cash payments accepted. Sales will sync automatically when reconnected.
        </div>
      )}
      {syncingOffline && (
        <div className="flex items-center gap-2 bg-blue-600 px-5 py-2 text-sm font-medium text-white">
          <Loader2 size={14} className="animate-spin" />
          Syncing offline transactions…
        </div>
      )}
      {pendingManagerReview.length > 0 && (
        <div className="flex items-center justify-between bg-orange-500 px-5 py-2 text-sm font-medium text-white">
          <span>
            {pendingManagerReview.length} offline transaction(s) need manager review after sync.
          </span>
          <button onClick={() => setPendingManagerReview([])} className="ml-4 underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Top bar */}
      <div className="flex items-center gap-2 sm:gap-4 border-b border-gray-200 bg-white px-3 sm:px-5 py-3">
        <div className="flex items-center gap-2 shrink-0">
          <ShoppingCart size={16} className="text-purple-600" />
          <span className="font-semibold text-gray-900 hidden sm:inline">New Sale</span>
        </div>

        {sessionsLoading ? (
          <Skeleton className="h-7 w-40 rounded-lg" />
        ) : openSessions.length > 1 ? (
          <div className="relative">
            <select
              className="appearance-none cursor-pointer rounded-lg border border-gray-200 bg-white py-1.5 pl-3 pr-8 text-sm text-gray-700 outline-none transition-colors focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
            >
              <option value="">Select session…</option>
              {openSessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.terminal?.branch?.name ? `${s.terminal.branch.name} · ` : ''}
                  {s.terminal?.terminalCode ?? s.terminalId} — {s.cashier?.name || 'Cashier'}
                </option>
              ))}
            </select>
            <ChevronDown
              size={13}
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400"
            />
          </div>
        ) : activeSession ? (
          <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
            {activeSession.terminal?.name ?? activeSession.terminalId}
          </span>
        ) : null}

        {cart.length > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => {
                setShowParkModal(true)
                setParkLabel('')
              }}
              disabled={!!cancellationReqId}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700 disabled:opacity-40"
            >
              <PauseCircle size={13} /> Park Sale
            </button>
            <button
              onClick={() => {
                setShowCancelModal(true)
                setCancelError('')
              }}
              disabled={!!cancellationReqId}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-40"
            >
              <XCircle size={13} /> Cancel Sale
            </button>
          </div>
        )}
      </div>

      {/* Cancellation pending banner */}
      {cancellationReqId && (
        <div className="flex items-center gap-3 border-b border-orange-200 bg-orange-50 px-5 py-3">
          <Loader2 size={14} className="animate-spin shrink-0 text-orange-500" />
          <p className="text-sm font-medium text-orange-700">
            Cancellation request pending manager approval — cart is locked.
          </p>
        </div>
      )}

      {/* Serial-tracked sale banner */}
      {!cancellationReqId && cart.some((l) => l.isSerialTracked) && (
        <div
          className={`flex items-center gap-3 border-b px-5 py-3 ${canOverride ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}
        >
          {canOverride ? (
            <CheckCircle2 size={14} className="shrink-0 text-green-500" />
          ) : (
            <ShieldCheck size={14} className="shrink-0 text-amber-500" />
          )}
          <p className={`text-sm font-medium ${canOverride ? 'text-green-700' : 'text-amber-700'}`}>
            {canOverride
              ? 'This sale includes a serialized item — since you can already approve sales, it will post immediately.'
              : 'This sale includes a serialized item — it will need Business Owner or Branch Manager approval before the invoice is created.'}
          </p>
        </div>
      )}

      {/* Mobile panel tabs — hidden on md+ */}
      <div className="flex md:hidden border-b border-gray-200 bg-white shrink-0">
        <button
          onClick={() => setMobilePanel('catalog')}
          className={`flex flex-1 items-center justify-center gap-2 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            mobilePanel === 'catalog'
              ? 'border-purple-600 text-purple-700 bg-purple-50/60'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Search size={12} /> Items
        </button>
        <button
          onClick={() => setMobilePanel('checkout')}
          className={`flex flex-1 items-center justify-center gap-2 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            mobilePanel === 'checkout'
              ? 'border-purple-600 text-purple-700 bg-purple-50/60'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Receipt size={12} /> Checkout
          {cart.length > 0 && (
            <span className="bg-purple-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none">
              {cart.length}
            </span>
          )}
        </button>
      </div>

      {/* Two-panel layout */}
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        {/* ── Left: Catalog + Cart ────────────────────────────────────────────── */}
        <div
          className={`flex-col overflow-hidden border-b md:border-b-0 md:border-r border-gray-200 bg-white ${mobilePanel === 'catalog' ? 'flex flex-1' : 'hidden md:flex md:flex-1'}`}
        >
          {/* Search bar */}
          <div className="shrink-0 border-b border-gray-100 px-4 py-3 space-y-2">
            {/* Mode toggle */}
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                autoFocus
                className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-4 text-sm outline-none focus:border-purple-400 focus:bg-white focus:ring-2 focus:ring-purple-100"
                placeholder="Search by name or serial"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            {catalogItems.length > 0 && (
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-gray-400">
                  {displayItems.length} item
                  {displayItems.length !== 1 ? 's' : ''}
                  {searchQuery && ` matching "${searchQuery}"`}
                </p>
                <div className="flex items-center gap-0.5 rounded-md border border-gray-200 p-0.5">
                  <button
                    type="button"
                    onClick={() => setCatalogViewMode('grid')}
                    title="Grid view"
                    className={`rounded p-1 transition-colors ${catalogViewMode === 'grid' ? 'bg-purple-100 text-purple-700' : 'text-gray-400 hover:text-gray-600'}`}
                  >
                    <LayoutGrid size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCatalogViewMode('list')}
                    title="List view"
                    className={`rounded p-1 transition-colors ${catalogViewMode === 'list' ? 'bg-purple-100 text-purple-700' : 'text-gray-400 hover:text-gray-600'}`}
                  >
                    <List size={13} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Catalog grid */}
          <div className="flex-1 overflow-y-auto bg-gray-50/60 p-3">
            {catalogLoading ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-2">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-24 animate-pulse rounded-xl border border-gray-100 bg-gray-100"
                  />
                ))}
              </div>
            ) : catalogError ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-red-400">
                <AlertTriangle size={32} strokeWidth={1.2} />
                <p className="text-sm font-medium">Could not load items</p>
                <p className="text-xs text-red-400">{catalogError}</p>
              </div>
            ) : displayItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-gray-400">
                <Search size={32} strokeWidth={1.2} />
                <p className="text-sm">
                  {searchQuery ? `No items match "${searchQuery}"` : 'No items available'}
                </p>
              </div>
            ) : catalogViewMode === 'list' ? (
              <div className="flex flex-col gap-1.5">
                {displayItems.map((item) => (
                  <CatalogListRow
                    key={item.id}
                    item={item}
                    qty={cartQtyMap[item.id] ?? 0}
                    onAdd={!!cancellationReqId ? () => {} : addToCart}
                    onAddMeasured={!!cancellationReqId ? () => {} : setMeasuredItem}
                    stockKnown={catalogStockKnown}
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-2">
                {displayItems.map((item) => (
                  <CatalogCard
                    key={item.id}
                    item={item}
                    qty={cartQtyMap[item.id] ?? 0}
                    onAdd={!!cancellationReqId ? () => {} : addToCart}
                    onAddMeasured={!!cancellationReqId ? () => {} : setMeasuredItem}
                    stockKnown={catalogStockKnown}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Empty cart hint */}
          {cart.length === 0 && !catalogLoading && (
            <div className="shrink-0 border-t border-gray-100 px-4 py-3 text-center">
              <p className="text-xs text-gray-400">Click an item above to add it to the cart</p>
            </div>
          )}

          {/* Mobile go-to-checkout bar — sticky at the bottom of the catalog panel */}
          {cart.length > 0 && (
            <div className="md:hidden shrink-0 border-t border-purple-100 bg-purple-700 px-4 py-3 flex items-center justify-between gap-3">
              <div className="text-white min-w-0">
                <p className="text-[11px] opacity-75">
                  {cart.length} item{cart.length !== 1 ? 's' : ''}
                </p>
                <p className="text-base font-bold truncate">{fmt(totalAmount)}</p>
              </div>
              <button
                onClick={() => setMobilePanel('checkout')}
                className="shrink-0 bg-white text-purple-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-purple-50 active:scale-[0.97] transition-all"
              >
                Checkout →
              </button>
            </div>
          )}
        </div>

        {/* ── Right: Customer + Summary + Payment ─────────────────────────────── */}
        <div
          className={`flex-col overflow-y-auto border-purple-600 bg-purple-50/60 shadow-[-6px_0_16px_-6px_rgba(0,0,0,0.18)] md:flex-shrink-0 md:w-130 lg:w-150 md:border-l-4 ${mobilePanel === 'checkout' ? 'flex flex-1' : 'hidden md:flex'}`}
        >
          {/* Customer */}
          <div className="border-b border-purple-200 p-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-700">
              Customer
            </p>

            {selectedCustomer ? (
              <div>
                <div className="flex items-center justify-between rounded-lg bg-purple-200 px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-purple-200">
                      <User size={13} className="text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {customerDisplayName(selectedCustomer)}
                      </p>
                      <div className="flex items-center gap-2">
                        {selectedCustomer.phone && (
                          <p className="text-xs text-gray-700">{selectedCustomer.phone}</p>
                        )}
                        {loyaltyAccount && (
                          <p className="text-xs font-medium text-purple-500">
                            {loyaltyAccount.currentPoints} pts
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {customerHistory.length > 0 && (
                      <button
                        onClick={() => setHistoryOpen((v) => !v)}
                        className="flex items-center gap-0.5 text-xs font-medium text-purple-400 hover:text-purple-700"
                      >
                        {historyOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                        {customerHistory.length} past
                      </button>
                    )}
                    <button
                      onClick={clearCustomer}
                      className="text-purple-300 hover:text-purple-600"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>

                {historyOpen && customerHistory.length > 0 && (
                  <div className="mt-1 divide-y divide-gray-300 rounded-lg border border-purple-200 bg-gray-200">
                    {customerHistory.map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between px-3 py-1.5 text-xs"
                      >
                        <span className="font-mono text-gray-700">{tx.transactionNumber}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-700">
                            {new Date(tx.occurredAt ?? tx.createdAt).toLocaleDateString('en-PH', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                          <span className="font-semibold text-gray-800">{fmt(tx.totalAmount)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search
                    size={12}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-700"
                  />
                  <input
                    className="w-full rounded-lg border border-purple-200 bg-white py-2 pl-8 pr-7 text-xs outline-none focus:border-purple-400 focus:bg-white focus:ring-2 focus:ring-purple-100"
                    placeholder="Search by name or phone…"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    onBlur={() => setTimeout(() => setCustomerSearchOpen(false), 150)}
                    onFocus={() => customerResults.length > 0 && setCustomerSearchOpen(true)}
                  />
                  {searchingCustomers && (
                    <Loader2
                      size={11}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-gray-700"
                    />
                  )}
                </div>

                {customerSearchOpen && (
                  <div className="mt-1 max-h-36 overflow-y-auto rounded-xl border border-purple-200 bg-white shadow-lg">
                    {customerResults.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-gray-700">No customers found</p>
                    ) : (
                      customerResults.map((c) => (
                        <button
                          key={c.id}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-purple-50"
                          onMouseDown={() => selectCustomer(c)}
                        >
                          <User size={11} className="shrink-0 text-gray-700" />
                          <div>
                            <p className="font-medium text-gray-900">{customerDisplayName(c)}</p>
                            {c.phone && <p className="text-xs text-gray-700">{c.phone}</p>}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}

                <button
                  onClick={() => setShowNewCustomerModal(true)}
                  className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-purple-300 py-2 text-xs text-gray-700 transition-colors hover:border-purple-500 hover:bg-purple-50 hover:text-purple-600 active:scale-[0.98]"
                >
                  <UserPlus size={12} /> New Customer
                </button>
              </>
            )}
          </div>

          {/* QMS tab origin banner */}
          {fromTab && (
            <div className="flex items-center gap-2 px-5 py-2 bg-amber-50 border-b border-amber-200">
              <UtensilsCrossed className="w-4 h-4 text-amber-600 shrink-0" />
              <p className="text-xs text-amber-800 font-medium">
                From QMS — Table {fromTab.tableName}. Table will be set to Needs Bussing after
                payment.
              </p>
            </div>
          )}

          {/* Order summary */}
          <div className="border-b border-purple-200 p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-700">
              Order Summary
            </p>
            <div className="space-y-1.5 text-sm">
              {/* Cart — moved into Order Summary so it's always visible next
                  to the totals, instead of scrolled past at the bottom of
                  the catalog list. */}
              {cart.length > 0 && (
                <div className="max-h-72 overflow-y-auto rounded-lg border border-purple-100 bg-white">
                  <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white/95 px-4 py-2 backdrop-blur-sm">
                    <div className="flex items-center gap-2">
                      <ShoppingCart size={12} className="text-purple-500" />
                      <span className="text-xs font-semibold text-gray-700">
                        Cart · {displayGroups.length} item{displayGroups.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-gray-900">{fmt(subtotal)}</span>
                  </div>
                  <div className="scroll-fade-x overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <tbody className="divide-y divide-gray-50">
                        {displayGroups.map((group) => {
                          const line = group[0]
                          const groupQty = group.length
                          const lineTaxRate = resolveLineTaxRate(line, activeTaxRate)
                          const isGrouped = groupQty > 1

                          return (
                            <Fragment key={line.lineId}>
                              <tr className="group hover:bg-gray-50">
                                <td className="px-4 py-2">
                                  <p className="text-xs font-medium text-gray-900">
                                    {itemDisplayLabel({
                                      name: line.itemName,
                                      brandName: line.brandName,
                                      categoryName: line.categoryName,
                                      modelNumber: line.modelNumber,
                                    })}
                                    {isGrouped && (
                                      <span className="ml-1 text-gray-400">× {groupQty}</span>
                                    )}
                                  </p>
                                  {line.sku && (
                                    <p className="text-[10px] text-gray-400">{line.sku}</p>
                                  )}
                                  {line.isSerialTracked &&
                                    (isGrouped ? (
                                      group.some((l) => !l.serialNumberId) ? (
                                        <button
                                          onClick={() =>
                                            setSerialPickerTarget(
                                              group.find((l) => !l.serialNumberId)!
                                            )
                                          }
                                          className="mt-0.5 text-[10px] font-medium text-amber-500 underline-offset-2 hover:underline"
                                        >
                                          ⚠ {group.filter((l) => !l.serialNumberId).length} of{' '}
                                          {groupQty} serial{groupQty !== 1 ? 's' : ''} needed
                                        </button>
                                      ) : (
                                        <p className="mt-0.5 flex flex-wrap gap-x-1 text-[10px]">
                                          <span className="text-gray-400">SN:</span>
                                          {group.map((l, i) => (
                                            <button
                                              key={l.lineId}
                                              onClick={() => setSerialPickerTarget(l)}
                                              className="font-medium text-green-600 underline-offset-2 hover:underline"
                                            >
                                              {l.serialNumberLabel}
                                              {i < group.length - 1 ? ',' : ''}
                                            </button>
                                          ))}
                                        </p>
                                      )
                                    ) : (
                                      <button
                                        onClick={() => setSerialPickerTarget(line)}
                                        className={`mt-0.5 text-[10px] font-medium underline-offset-2 hover:underline ${line.serialNumberId ? 'text-green-600' : 'text-amber-500'}`}
                                      >
                                        {line.serialNumberId
                                          ? `SN: ${line.serialNumberLabel}`
                                          : '⚠ Select serial'}
                                      </button>
                                    ))}
                                  {lineTaxRate != null ? (
                                    <span className="text-[9px] font-semibold text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded">
                                      {line.taxRate == null
                                        ? (activeTaxRate?.name ?? `VAT ${lineTaxRate}%`)
                                        : `VAT ${lineTaxRate}%`}
                                    </span>
                                  ) : (
                                    <span className="text-[9px] font-semibold text-gray-400 bg-gray-100 px-1 py-0.5 rounded">
                                      No Tax
                                    </span>
                                  )}
                                  {saleMode !== 'reserve' && (
                                    <div className="mt-1">
                                      <PriceUseSelector
                                        compact
                                        priceUseTypes={priceUseTypes}
                                        value={line.priceUseTypeId ?? ''}
                                        onChange={(id) =>
                                          setLinePriceUseTypeId(
                                            group.map((l) => l.lineId),
                                            id
                                          )
                                        }
                                        isLoading={isResolvingPrices}
                                      />
                                    </div>
                                  )}
                                </td>
                                <td className="px-3 py-2">
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      onClick={() =>
                                        line.isSerialTracked
                                          ? removeLastUnitOfItem(line.itemId)
                                          : line.allowDecimal
                                            ? removeFromCart(line.itemId)
                                            : setQty(line.itemId, line.quantity - 1)
                                      }
                                      disabled={!!cancellationReqId}
                                      className="flex h-6 w-6 items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:border-purple-300 hover:bg-purple-50 hover:text-purple-700 disabled:opacity-40"
                                    >
                                      <Minus size={10} />
                                    </button>
                                    {line.allowDecimal ? (
                                      <div className="flex flex-col items-center gap-0.5">
                                        <input
                                          type="number"
                                          min="0.001"
                                          step="0.1"
                                          value={line.quantity}
                                          onChange={(e) => {
                                            const v = parseFloat(e.target.value)
                                            if (!isNaN(v) && v > 0) setQty(line.itemId, v)
                                          }}
                                          className="w-14 rounded border border-gray-200 px-1 text-center text-xs font-semibold outline-none focus:border-purple-400 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                        />
                                        {line.uomCode && (
                                          <span className="text-[9px] text-gray-400 uppercase">
                                            {line.uomCode}
                                          </span>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="w-6 text-center text-xs font-semibold">
                                        {line.isSerialTracked ? groupQty : line.quantity}
                                      </span>
                                    )}
                                    <button
                                      onClick={() =>
                                        line.isSerialTracked
                                          ? addUnitOfItem(line.itemId)
                                          : line.allowDecimal
                                            ? setMeasuredItem({
                                                id: line.itemId,
                                                name: line.itemName,
                                                sku: line.sku,
                                                price: line.unitPrice,
                                                taxRate: line.taxRate,
                                                uomCode: line.uomCode,
                                                allowDecimal: true,
                                              })
                                            : setQty(line.itemId, line.quantity + 1)
                                      }
                                      className="flex h-6 w-6 items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:border-purple-300 hover:bg-purple-50 hover:text-purple-700"
                                    >
                                      <Plus size={10} />
                                    </button>
                                  </div>
                                </td>
                                <td className="px-3 py-2 text-right text-xs font-semibold text-gray-900">
                                  {line.priceResolved ? (
                                    <div className="flex flex-col items-end gap-0.5">
                                      {fmt(
                                        displayUnitPriceWithTax(
                                          line,
                                          activeTaxRate,
                                          inclusivePricing
                                        ) * groupQty
                                      )}
                                      {line.priceOverrideBy && (
                                        <button
                                          onClick={() => setPriceOverrideTargetLineId(line.lineId)}
                                          className="text-[9px] font-semibold text-amber-600 underline decoration-dotted hover:text-amber-800"
                                          title={`Overridden by ${line.priceOverrideApproverName ?? 'a manager'}`}
                                        >
                                          Overridden
                                        </button>
                                      )}
                                    </div>
                                  ) : !line.priceUseTypeId ? (
                                    <span className="text-[10px] font-medium text-gray-400">
                                      — Select Price Use
                                    </span>
                                  ) : (
                                    <button
                                      onClick={() => setPriceOverrideTargetLineId(line.lineId)}
                                      className="rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700 hover:bg-amber-100"
                                    >
                                      No price — Override
                                    </button>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  <button
                                    onClick={() => removeFromCart(line.itemId)}
                                    className="text-gray-300 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-500"
                                  >
                                    <X size={12} />
                                  </button>
                                </td>
                              </tr>
                            </Fragment>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex justify-between text-gray-700">
                <span>
                  Subtotal ({cart.length} item{cart.length !== 1 ? 's' : ''})
                </span>
                <span>{fmt(vatExclSubtotalForBackend)}</span>
              </div>
              {promoDiscount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span>−{fmt(promoDiscount)}</span>
                </div>
              )}
              {cart.length > 0 &&
                !isTaxExempt &&
                (hasMixedTaxRates || uniformLineTaxRate != null) && (
                  <div className="flex justify-between text-gray-700 text-xs">
                    <span>
                      {hasMixedTaxRates
                        ? 'Mixed VAT rates'
                        : uniformLineTaxRate != null
                          ? `${uniformLineTaxRate === activeTaxRate?.rate ? (activeTaxRate?.name ?? 'VAT') : 'VAT'} (${uniformLineTaxRate}%)`
                          : (activeTaxRate?.name ?? 'VAT')}
                    </span>
                    <span>{fmt(taxTotal)}</span>
                  </div>
                )}
              {isTaxExempt && (
                <div className="flex justify-between text-green-600 text-xs">
                  <span>Tax Exempt</span>
                  <span>—</span>
                </div>
              )}
              {saleMode === 'sale' && (
                <div className="flex items-center justify-between gap-2">
                  <span>Delivery fee (optional)</span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    aria-label="Delivery fee"
                    placeholder="0.00"
                    value={deliveryFeeInput}
                    onChange={(e) => setDeliveryFeeInput(e.target.value)}
                    className="w-24 rounded-lg border border-purple-200 px-2 py-1 text-right font-mono text-xs outline-none focus:border-prominent-purple-400 focus:ring-2 focus:ring-prominent-purple-100"
                  />
                </div>
              )}
            </div>
            <div className="mt-3 flex items-baseline justify-between border-t border-purple-200 pt-3">
              <span className="text-sm font-semibold text-gray-700">Total</span>
              <span className="text-2xl font-bold text-gray-900">
                {fmt(saleMode === 'sale' ? grandTotalWithFee : totalAmount)}
              </span>
            </div>

            {/* Tax exempt toggle */}
            <div className="mt-3 flex items-center justify-between border-t border-purple-200 pt-3">
              <div className="flex items-center gap-1.5">
                <ShieldCheck
                  size={13}
                  className={isTaxExempt ? 'text-green-500' : 'text-gray-700'}
                />
                <span className="text-xs text-gray-700">Tax Exempt</span>
              </div>
              <button
                onClick={() => {
                  setIsTaxExempt((v) => !v)
                  setTaxExemptionRef('')
                }}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${isTaxExempt ? 'bg-green-500' : 'bg-gray-200'}`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${isTaxExempt ? 'translate-x-4' : 'translate-x-0'}`}
                />
              </button>
            </div>
            {isTaxExempt && (
              <input
                className="mt-2 w-full rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100"
                placeholder="Certificate / exemption reference"
                value={taxExemptionRef}
                onChange={(e) => setTaxExemptionRef(e.target.value)}
              />
            )}
          </div>

          {/* Promo code */}
          <div className="border-b border-purple-200 p-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-700">
              Promo Code
            </p>
            {promoResult?.valid ? (
              <div className="flex items-center justify-between rounded-lg bg-green-50 px-3 py-2">
                <div className="flex items-center gap-2 text-sm text-green-700">
                  <Tag size={12} />
                  <span className="font-mono font-semibold">{promoResult.promoCode?.code}</span>
                  <span className="text-green-500">−{fmt(promoResult.discountAmount ?? 0)}</span>
                </div>
                <button onClick={clearPromo} className="text-green-300 hover:text-green-600">
                  <X size={13} />
                </button>
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <input
                    className="flex-1 rounded-lg border border-purple-200 px-3 py-2 font-mono text-sm uppercase tracking-wider outline-none placeholder:normal-case placeholder:tracking-normal focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                    placeholder="Enter promo code"
                    value={promoInput}
                    onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && applyPromo()}
                  />
                  <button
                    onClick={applyPromo}
                    disabled={!promoInput.trim() || validatingPromo || cart.length === 0}
                    className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-300 active:scale-[0.97] disabled:opacity-40"
                  >
                    {validatingPromo ? '…' : 'Apply'}
                  </button>
                </div>
                {promoError && <p className="mt-1.5 text-xs text-red-500">{promoError}</p>}
              </>
            )}

            {/* Manager override banner */}
            {needsManagerOverride && (
              <div className="mt-3">
                {managerOverrideApproved ? (
                  <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-xs text-green-700">
                    <ShieldCheck size={13} />
                    <span>
                      Override approved by{' '}
                      <span className="font-semibold">{overrideManagerName}</span>
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                    <div className="flex items-center gap-2 text-xs text-amber-700">
                      <AlertTriangle size={13} />
                      <span>
                        Discount {discountPct.toFixed(0)}% exceeds {discountThreshold}% threshold —
                        manager override required
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        setOverrideError('')
                        setShowOverrideDialog(true)
                      }}
                      className="ml-2 shrink-0 flex items-center gap-1 rounded-lg bg-amber-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-600"
                    >
                      <KeyRound size={11} /> Override
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sale Mode — each cart line below picks its own Cash / Charge /
              Installment mode; Reserve stays a separate whole-cart mode. */}
          <div className="border-t border-purple-200 px-5 py-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-700">
              Sale Mode
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => handleSaleModeChange('sale')}
                className={`flex-1 rounded-xl border py-2.5 text-xs font-semibold transition-colors active:scale-[0.97] ${
                  saleMode === 'sale'
                    ? 'border-purple-500 bg-purple-200 text-purple-700'
                    : 'border-purple-200 bg-white text-gray-700 hover:border-purple-300'
                }`}
              >
                Sale
                <span className="mt-0.5 block text-xs font-normal opacity-70">
                  Cash / charge / installment per item
                </span>
              </button>
              <button
                onClick={() => handleSaleModeChange('reserve')}
                className={`flex-1 rounded-xl border py-2.5 text-xs font-semibold transition-colors active:scale-[0.97] ${
                  saleMode === 'reserve'
                    ? 'border-amber-500 bg-amber-50 text-amber-700'
                    : 'border-purple-200 bg-white text-gray-700 hover:border-purple-300'
                }`}
              >
                Reserve
                <span className="mt-0.5 block text-xs font-normal opacity-70">
                  No serial yet, optional deposit
                </span>
              </button>
            </div>
            {saleMode === 'reserve' && (
              <div className="mt-2.5 space-y-2">
                {!selectedCustomer && (
                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    A customer must be selected to reserve an item.
                  </p>
                )}
                <p className="rounded-lg bg-gray-200 px-3 py-2 text-xs text-gray-700">
                  Reserves one item by SKU — picking another item replaces it. Serials aren&apos;t
                  needed yet; one will be earmarked when stock arrives.
                </p>
              </div>
            )}
            {saleMode === 'sale' && hasChargeOrInstallmentLine && !selectedCustomer && (
              <p className="mt-2.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                A customer must be selected — this cart has an installment item.
              </p>
            )}

            {saleMode === 'sale' && cart.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-[13px] font-semibold uppercase tracking-wide text-gray-500">
                  Payment Mode
                </p>
                {/* Cash / Installment / Debit-Credit Card — one choice for
                    the whole cart, never per item. If any item needs a
                    different mode, it's a separate transaction. */}
                <div className="relative">
                  <div className="flex gap-1.5 rounded-lg border border-purple-200 bg-white p-1">
                    {(['cash', 'installment', 'credit_card'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => {
                          setPaymentMode(mode)
                          setLineInvoiceType(
                            cart.map((l) => l.lineId),
                            mode === 'installment' ? 'installment' : 'cash'
                          )
                        }}
                        className={`flex-1 rounded-lg px-2 py-1.5 text-[13px] font-semibold transition-colors ${
                          paymentMode === mode
                            ? 'bg-prominent-purple-200 text-prominent-purple-800'
                            : 'bg-white text-gray-500 hover:bg-gray-100'
                        }`}
                      >
                        {mode === 'cash'
                          ? 'Cash'
                          : mode === 'installment'
                            ? 'Installment'
                            : 'Debit/Credit Card'}
                      </button>
                    ))}
                  </div>
                </div>
                {displayGroups.map((group) => {
                  const line = group[0]
                  const groupQty = group.length
                  const groupLineIds = group.map((l) => l.lineId)
                  const groupMode = line.invoiceType ?? 'cash'
                  const groupProvider = line.installmentProvider ?? 'inhouse'
                  const lineSaleAmount =
                    displayUnitPriceWithTax(line, activeTaxRate, inclusivePricing) * line.quantity
                  const minDownPayment = 0.1 * lineSaleAmount
                  // Whole pesos, rounded up — matches the auto-fill in
                  // setLineFinancingTermId() so the displayed floor is never
                  // a centavo amount the field itself won't accept.
                  const minDownPaymentWhole = Math.ceil(minDownPayment)
                  const downPaymentValue = line.downPaymentInput
                    ? parseFloat(line.downPaymentInput) || 0
                    : minDownPaymentWhole
                  const downPaymentEditingThisLine = !!downPaymentEditOpen[line.lineId]
                  return (
                    <div key={line.lineId} className="rounded-lg border border-purple-100 p-2.5">
                      {/* Name only, as a label for the config below — price
                          lives in Order Summary now, not duplicated here. */}
                      <p className="mb-1.5 truncate text-xs font-medium text-gray-800">
                        {itemDisplayLabel({
                          name: line.itemName,
                          brandName: line.brandName,
                          categoryName: line.categoryName,
                          modelNumber: line.modelNumber,
                        })}
                        {groupQty > 1 && <span className="text-gray-400"> × {groupQty}</span>}
                      </p>
                      {groupMode === 'installment' && (
                        <div className="mt-2 space-y-3">
                          <div className="flex gap-1.5">
                            {(['inhouse', 'tpf'] as InstallmentProvider[]).map((provider) => (
                              <button
                                key={provider}
                                onClick={() => setLineInstallmentProvider(groupLineIds, provider)}
                                className={`flex-1 rounded-lg px-2 py-1 text-xs font-semibold transition-colors ${
                                  groupProvider === provider
                                    ? 'bg-prominent-purple-200 text-prominent-purple-800'
                                    : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                                }`}
                              >
                                {provider === 'inhouse' ? 'Inhouse Installment' : 'TPF Installment'}
                              </button>
                            ))}
                          </div>
                          {groupProvider === 'inhouse' && (
                            <>
                              <div className="relative">
                                <select
                                  value={line.financingTermId ?? ''}
                                  onChange={(e) =>
                                    setLineFinancingTermId(groupLineIds, e.target.value)
                                  }
                                  className="w-full appearance-none rounded-lg border border-purple-200 bg-white py-1.5 pl-2 pr-6 text-[13px] text-gray-800 outline-none focus:border-prominent-purple-400 focus:ring-2 focus:ring-prominent-purple-100"
                                >
                                  <option value="">Select a term…</option>
                                  {financingTerms.map((t) => (
                                    <option key={t.id} value={t.id}>
                                      {t.termMonths} months
                                    </option>
                                  ))}
                                </select>
                                <ChevronDown
                                  size={11}
                                  className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-500"
                                />
                              </div>
                              {downPaymentEditingThisLine ? (
                                <>
                                  <input
                                    type="number"
                                    min={0}
                                    step={1}
                                    placeholder="Down payment"
                                    autoFocus
                                    value={line.downPaymentInput ?? ''}
                                    onChange={(e) =>
                                      setLineDownPaymentInput(groupLineIds, e.target.value)
                                    }
                                    onBlur={(e) => {
                                      // Normalize to a whole peso on blur (round up,
                                      // never below the 10% floor) rather than
                                      // fighting the cashier's typing keystroke by
                                      // keystroke.
                                      const parsed = parseFloat(e.target.value)
                                      if (!Number.isFinite(parsed)) return
                                      setLineDownPaymentInput(
                                        groupLineIds,
                                        Math.ceil(parsed).toFixed(2)
                                      )
                                    }}
                                    className="w-full rounded-lg border border-purple-200 px-2 py-1.5 text-right text-[13px] outline-none focus:border-prominent-purple-400 focus:ring-2 focus:ring-prominent-purple-100"
                                  />
                                  <p className="text-xs text-gray-500">
                                    Must be at least {fmt(minDownPaymentWhole)} and no more than{' '}
                                    {fmt(lineSaleAmount)}.
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => toggleDownPaymentEdit(line.lineId)}
                                    className="text-left text-xs font-medium text-prominent-purple-500 underline decoration-dotted underline-offset-2 hover:text-prominent-purple-700"
                                  >
                                    Use the minimum instead
                                  </button>
                                </>
                              ) : (
                                <div className="rounded-lg border border-prominent-purple-100 bg-prominent-purple-50 px-2.5 py-1.5">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-[13px] font-semibold text-prominent-purple-700">
                                      Down payment
                                    </span>
                                    <span className="shrink-0 rounded-full bg-prominent-purple-200 px-2 py-0.5 text-[10px] font-bold text-prominent-purple-700">
                                      10% min
                                    </span>
                                  </div>
                                  <div className="mt-1 flex items-center gap-2 pl-4">
                                    <span className="text-[15px] font-bold text-prominent-purple-800">
                                      {fmt(downPaymentValue)}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => toggleDownPaymentEdit(line.lineId)}
                                      className="shrink-0 text-xs font-medium text-prominent-purple-500 underline decoration-dotted underline-offset-2 hover:text-prominent-purple-700"
                                    >
                                      Change amount
                                    </button>
                                  </div>
                                </div>
                              )}
                              <p className="flex items-start gap-1 text-xs text-prominent-purple-500">
                                <span className="text-prominent-purple-400">●</span>
                                Fixed at 10% of the sale amount — the same for every term.
                              </p>
                              {line.financingTermId && (
                                <div className="rounded-lg bg-prominent-purple-50 px-2.5 py-1.5 text-[13px] text-prominent-purple-700">
                                  {installmentPreviewLoading[line.lineId] ? (
                                    <span className="flex items-center gap-1.5">
                                      <Loader2 size={10} className="animate-spin" /> Calculating…
                                    </span>
                                  ) : installmentPreviews[line.lineId] ? (
                                    <div className="flex items-center justify-between">
                                      <span>
                                        {fmt(installmentPreviews[line.lineId]!.monthlyInstallment)}
                                        /mo
                                      </span>
                                      <span className="font-semibold">
                                        {fmt(installmentPreviews[line.lineId]!.totalPayable)} total
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="opacity-70">
                                      {installmentPreviewErrors[line.lineId] ??
                                        'Preview unavailable.'}
                                    </span>
                                  )}
                                </div>
                              )}
                            </>
                          )}
                          {groupProvider === 'tpf' && (
                            <>
                              {downPaymentEditingThisLine ? (
                                <>
                                  <input
                                    type="number"
                                    min={0}
                                    step={1}
                                    placeholder="Down payment"
                                    autoFocus
                                    value={line.downPaymentInput ?? ''}
                                    onChange={(e) =>
                                      setLineDownPaymentInput(groupLineIds, e.target.value)
                                    }
                                    onBlur={(e) => {
                                      const parsed = parseFloat(e.target.value)
                                      if (!Number.isFinite(parsed)) return
                                      setLineDownPaymentInput(
                                        groupLineIds,
                                        Math.ceil(parsed).toFixed(2)
                                      )
                                    }}
                                    className="w-full rounded-lg border border-purple-200 px-2 py-1.5 text-right text-[13px] outline-none focus:border-prominent-purple-400 focus:ring-2 focus:ring-prominent-purple-100"
                                  />
                                  <p className="text-xs text-gray-500">
                                    Must be at least {fmt(minDownPaymentWhole)} and no more than{' '}
                                    {fmt(lineSaleAmount)}.
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => toggleDownPaymentEdit(line.lineId)}
                                    className="text-left text-xs font-medium text-prominent-purple-500 underline decoration-dotted underline-offset-2 hover:text-prominent-purple-700"
                                  >
                                    Use the minimum instead
                                  </button>
                                </>
                              ) : (
                                <div className="rounded-lg border border-prominent-purple-100 bg-prominent-purple-50 px-2.5 py-1.5">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-[13px] font-semibold text-prominent-purple-700">
                                      Down payment
                                    </span>
                                    <span className="shrink-0 rounded-full bg-prominent-purple-200 px-2 py-0.5 text-[10px] font-bold text-prominent-purple-700">
                                      10% min
                                    </span>
                                  </div>
                                  <div className="mt-1 flex items-center gap-2 pl-4">
                                    <span className="text-[15px] font-bold text-prominent-purple-800">
                                      {fmt(downPaymentValue)}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => toggleDownPaymentEdit(line.lineId)}
                                      className="shrink-0 text-xs font-medium text-prominent-purple-500 underline decoration-dotted underline-offset-2 hover:text-prominent-purple-700"
                                    >
                                      Change amount
                                    </button>
                                  </div>
                                </div>
                              )}
                              <p className="rounded-lg bg-gray-50 px-2.5 py-1.5 text-xs text-gray-500">
                                Collected here; the financier funds the{' '}
                                {fmt(Math.max(0, lineSaleAmount - downPaymentValue))} balance and
                                owns the schedule. Their details are entered once, just below.
                              </p>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
                {tpfInstallmentCartLines.length > 0 && (
                  <div className="rounded-xl border border-prominent-purple-100 bg-prominent-purple-50 px-4 py-3">
                    <p className="text-xs font-medium text-prominent-purple-700">
                      {tpfInstallmentCartLines.length} item
                      {tpfInstallmentCartLines.length !== 1 ? 's' : ''} on TPF installment
                    </p>
                    <p className="mt-1 text-[13px] text-prominent-purple-500">
                      {fmt(tpfDownPaymentsTotal)} down payment collected from the customer now;{' '}
                      {fmt(tpfFinancedTotal)} funded by the financier
                      {isPureTpfCart ? ' (recorded automatically, not tendered here)' : ''}. No
                      local schedule — the financier owns the amortization.
                    </p>
                    <div className="mt-2.5 space-y-2">
                      <div>
                        <label className="mb-1 block text-[13px] text-prominent-purple-700">
                          TPF Provider *
                        </label>
                        <div className="relative">
                          <select
                            value={tpfProviderId}
                            onChange={(e) => setTpfProviderId(e.target.value)}
                            className="w-full appearance-none rounded-lg border border-prominent-purple-200 bg-white px-2 py-1.5 pr-6 text-xs text-gray-800 outline-none focus:border-prominent-purple-400 focus:ring-2 focus:ring-prominent-purple-100"
                          >
                            <option value="">
                              {tpfProviders.length === 0
                                ? 'No TPF providers on file'
                                : 'Select a TPF provider…'}
                            </option>
                            {tpfProviders.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                          <ChevronDown
                            size={12}
                            className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-prominent-purple-700"
                          />
                        </div>
                        {tpfProviders.length === 0 && (
                          <p className="mt-1 text-[13px] text-amber-700">
                            Add a TPF provider under POS Settings first.
                          </p>
                        )}
                      </div>
                      <input
                        type="text"
                        placeholder="Financier's reference number *"
                        value={tpfReferenceNumber}
                        onChange={(e) => setTpfReferenceNumber(e.target.value)}
                        className="w-full rounded-lg border border-prominent-purple-200 px-2 py-1.5 text-xs outline-none focus:border-prominent-purple-400 focus:ring-2 focus:ring-prominent-purple-100"
                      />
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        placeholder="Approved amount (optional)"
                        value={tpfApprovedAmount}
                        onChange={(e) => setTpfApprovedAmount(e.target.value)}
                        className="w-full rounded-lg border border-prominent-purple-200 px-2 py-1.5 text-xs outline-none focus:border-prominent-purple-400 focus:ring-2 focus:ring-prominent-purple-100"
                      />
                    </div>
                  </div>
                )}
                {installmentCartLines.length > 0 && (
                  <div
                    data-testid="dp-payment-mode-toggle"
                    className="rounded-lg border border-prominent-purple-200 bg-prominent-purple-50/40 p-2.5"
                  >
                    <p className="mb-1.5 text-xs font-medium text-gray-800">
                      Down Payment
                      <span className="ml-1 font-normal text-gray-500">
                        ({fmt(allDownPaymentsTotal)})
                      </span>
                    </p>
                    <div className="flex gap-1.5">
                      {(['cash', 'credit_card'] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setInstallmentPaymentMethod(mode)}
                          className={`flex-1 rounded-lg px-2 py-1.5 text-[13px] font-semibold transition-colors ${
                            installmentPaymentMethod === mode
                              ? 'bg-prominent-purple-200 text-prominent-purple-800'
                              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}
                        >
                          {mode === 'cash' ? 'Cash' : 'Debit/Credit Card'}
                        </button>
                      ))}
                    </div>
                    {!installmentPaymentMethod && (
                      <p className="mt-1.5 text-[12px] text-amber-700">
                        Required before checkout can be completed.
                      </p>
                    )}
                  </div>
                )}
                {hasCashLine && (
                  <div
                    data-testid="cash-sub-mode-toggle"
                    className="rounded-lg border border-purple-100 p-2.5"
                  >
                    <p className="mb-1.5 text-xs font-medium text-gray-800">Cash</p>
                    <div className="flex gap-1.5">
                      {(['cash_on_hand', 'bank_transfer', 'qr'] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => {
                            setCashSubMode(mode)
                            setCashPaymentOptionId(undefined)
                            if (mode !== 'bank_transfer') setBankTransferVerifiedAtRegister(false)
                          }}
                          className={`flex-1 rounded-lg px-2 py-1.5 text-[13px] font-semibold transition-colors ${
                            cashSubMode === mode
                              ? 'bg-purple-200 text-purple-700'
                              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}
                        >
                          {mode === 'cash_on_hand'
                            ? 'Cash on Hand'
                            : mode === 'bank_transfer'
                              ? 'Bank Transfer'
                              : 'QR'}
                        </button>
                      ))}
                    </div>
                    {cashSubMode !== 'cash_on_hand' &&
                      (() => {
                        const config = configuredMethods.find((m) => m.key === cashSubMode)
                        const options = config?.options.filter((o) => o.isEnabled) ?? []
                        if (options.length === 0) return null
                        const label = cashSubMode === 'bank_transfer' ? 'Bank' : 'Gateway'
                        return (
                          <select
                            aria-label={label}
                            className="mt-1.5 w-full rounded-lg border border-purple-200 bg-white px-2 py-1.5 text-xs text-gray-800 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                            value={cashPaymentOptionId ?? ''}
                            onChange={(e) => setCashPaymentOptionId(e.target.value || undefined)}
                          >
                            <option value="">{`Select ${label.toLowerCase()}…`}</option>
                            {options.map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.name}
                              </option>
                            ))}
                          </select>
                        )
                      })()}
                    {cashSubMode === 'bank_transfer' && (
                      <label className="mt-1.5 flex items-center gap-1.5 text-[12px] text-gray-700">
                        <input
                          type="checkbox"
                          checked={bankTransferVerifiedAtRegister}
                          onChange={(e) => setBankTransferVerifiedAtRegister(e.target.checked)}
                          className="h-3.5 w-3.5 rounded border-gray-300"
                        />
                        Verified at register — the credit already landed, post straight to Cash in
                        Bank
                      </label>
                    )}
                  </div>
                )}
                {hasCreditCardLine && (
                  <div
                    data-testid="card-txn-mode-toggle"
                    className="rounded-lg border border-purple-100 p-2.5"
                  >
                    <p className="mb-1.5 text-xs font-medium text-gray-800">Select POS Terminal</p>
                    {(() => {
                      const cardConfig = configuredMethods.find((m) => m.key === 'card')
                      const terminalOptions = cardConfig?.options.filter((o) => o.isEnabled) ?? []
                      return (
                        <>
                          {terminalOptions.length > 0 && (
                            <select
                              aria-label="POS Terminal"
                              className="mb-1.5 w-full rounded-lg border border-purple-200 bg-white px-2 py-1.5 text-xs text-gray-800 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                              value={cardTerminalOptionId ?? ''}
                              onChange={(e) => setCardTerminalOptionId(e.target.value || undefined)}
                            >
                              <option value="">Select pos terminal…</option>
                              {terminalOptions.map((o) => (
                                <option key={o.id} value={o.id}>
                                  {o.name}
                                </option>
                              ))}
                            </select>
                          )}
                          <div className="flex gap-1.5">
                            {(['straight', 'installment'] as const).map((mode) => (
                              <button
                                key={mode}
                                type="button"
                                onClick={() => {
                                  setCardTxnMode(mode)
                                  if (mode === 'straight') setCardInstallmentTerm(undefined)
                                }}
                                className={`flex-1 rounded-lg px-2 py-1.5 text-[13px] font-semibold transition-colors ${
                                  cardTxnMode === mode
                                    ? mode === 'installment'
                                      ? 'bg-prominent-purple-100 text-prominent-purple-700'
                                      : 'bg-purple-200 text-purple-700'
                                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                }`}
                              >
                                {mode === 'straight' ? 'Straight' : 'Installment'}
                              </button>
                            ))}
                          </div>
                          {cardTxnMode === 'installment' && (
                            <select
                              aria-label="Term"
                              className={`mt-1.5 w-full rounded-lg border bg-white px-2 py-1.5 text-xs text-gray-800 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 ${!cardInstallmentTerm ? 'border-amber-300 bg-amber-50' : 'border-purple-200'}`}
                              value={cardInstallmentTerm ?? ''}
                              onChange={(e) =>
                                setCardInstallmentTerm(
                                  e.target.value ? Number(e.target.value) : undefined
                                )
                              }
                            >
                              <option value="">Select term… * required</option>
                              {[3, 6, 9, 12, 18, 24].map((m) => (
                                <option key={m} value={m}>
                                  {m} months
                                </option>
                              ))}
                            </select>
                          )}
                        </>
                      )
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Payment */}
          <div className="flex-1 p-5">
            {saleMode === 'reserve' && (
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-700">
                  Deposit (optional)
                </p>
                <button
                  onClick={addPaymentRow}
                  className="flex items-center gap-1 rounded-lg bg-purple-200 px-2.5 py-1 text-xs font-medium text-purple-700 hover:bg-purple-300"
                >
                  <Plus size={11} /> Add
                </button>
              </div>
            )}

            {saleMode === 'sale' && hasChargeOrInstallmentLine && (
              <div className="mb-3 space-y-2">
                {inhouseInstallmentCartLines.length > 0 && (
                  <div className="rounded-xl border border-prominent-purple-100 bg-prominent-purple-50 px-4 py-3">
                    <p className="text-xs font-medium text-prominent-purple-700">
                      {inhouseInstallmentCartLines.length} item
                      {inhouseInstallmentCartLines.length !== 1 ? 's' : ''} on inhouse installment
                    </p>
                    <p className="mt-1 text-[13px] text-prominent-purple-500">
                      Down payment {fmt(installmentDownPaymentsTotal)} collected now; the rest is
                      financed into each item&apos;s own AR schedule.
                    </p>
                    {selectedCustomer && (
                      <div className="mt-2.5">
                        <label className="mb-1 block text-[13px] text-prominent-purple-700">
                          Approved Credit Application
                        </label>
                        <div className="relative">
                          <select
                            value={creditApplicationId}
                            onChange={(e) => setCreditApplicationId(e.target.value)}
                            disabled={creditApplicationsLoading}
                            className="w-full appearance-none rounded-lg border border-prominent-purple-200 bg-white px-2 py-1.5 pr-6 text-xs text-gray-800 outline-none focus:border-prominent-purple-400 focus:ring-2 focus:ring-prominent-purple-100 disabled:opacity-50"
                          >
                            <option value="">
                              {creditApplicationsLoading
                                ? 'Loading…'
                                : approvedCreditApplications.length === 0
                                  ? 'No approved application on file'
                                  : 'Select an approved application…'}
                            </option>
                            {approvedCreditApplications.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.applicationNumber} · {a.items.map((i) => i.itemName).join(', ')}{' '}
                                · ₱
                                {a.requestedAmount.toLocaleString('en-PH', {
                                  minimumFractionDigits: 2,
                                })}
                              </option>
                            ))}
                          </select>
                          <ChevronDown
                            size={12}
                            className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-prominent-purple-700"
                          />
                        </div>
                        {!creditApplicationsLoading && approvedCreditApplications.length === 0 && (
                          <p className="mt-1 text-[13px] text-amber-700">
                            Every installment sale requires an approved credit application — open
                            one in Credit Applications first.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {saleMode === 'sale' && tenderTarget <= 0 ? (
              <p className="rounded-lg bg-gray-100 px-3 py-2 text-center text-xs text-gray-500">
                Nothing to collect at checkout for this cart.
              </p>
            ) : saleMode === 'reserve' && payments.length === 0 ? (
              <button
                onClick={addPaymentRow}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-purple-300 py-5 text-sm text-gray-700 transition-colors hover:border-purple-500 hover:bg-purple-50 hover:text-purple-600 active:scale-[0.98]"
              >
                <Plus size={14} /> Add deposit (optional)
              </button>
            ) : payments.length === 0 ? null : (
              <div className="space-y-2">
                {saleMode === 'sale' && (
                  <div className="flex items-center justify-between text-lg font-bold text-gray-900">
                    <span>Total</span>
                    <span>{fmt(tenderTarget)}</span>
                  </div>
                )}
                {payments.map((p, i) => {
                  if (saleMode === 'sale') {
                    // Method is fully decided by Item Payment Mode above (Cash's
                    // own sub-choice, or Credit/Debit Card) — no separate method
                    // picker or split-tender here, just how much was received.
                    return (
                      <div key={i} className="space-y-1">
                        <label className="text-xs font-medium text-gray-500">Amount received</label>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          aria-label="Amount received"
                          className="w-full rounded-lg border border-purple-200 px-3 py-2 text-right font-mono text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                          placeholder="0.00"
                          value={p.amount === 0 ? '' : p.amount}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value)
                            updatePayment(i, { amount: isNaN(val) ? 0 : val })
                          }}
                        />
                      </div>
                    )
                  }
                  return (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="relative min-w-0 flex-1">
                          <select
                            aria-label="Payment method"
                            className="w-full appearance-none cursor-pointer rounded-lg border border-purple-200 bg-white py-2 pl-2 pr-6 text-xs text-gray-800 outline-none transition-colors focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                            value={p.configId ?? p.method}
                            onChange={(e) => {
                              const val = e.target.value
                              setPaymentMethodEditOpen((prev) => ({ ...prev, [i]: true }))
                              if (configuredMethods.length > 0) {
                                const cfg = configuredMethods.find((m) => m.id === val)
                                if (cfg) {
                                  updatePayment(i, {
                                    method:
                                      cfg.type === 'custom'
                                        ? 'custom'
                                        : ((cfg.key as PosPaymentMethod) ?? 'custom'),
                                    configId: cfg.id,
                                    refFieldLabel: cfg.referenceFieldLabel ?? undefined,
                                    refRequired: cfg.referenceIsRequired,
                                    refRegex: cfg.referenceFieldRegex ?? undefined,
                                    referenceNumber: '',
                                    paymentMethodOptionId: undefined,
                                  })
                                  return
                                }
                              }
                              updatePayment(i, {
                                method: val as PosPaymentMethod,
                                configId: undefined,
                                paymentMethodOptionId: undefined,
                              })
                            }}
                          >
                            {configuredMethods.length > 0
                              ? configuredMethods
                                  .filter((m) => {
                                    if (isOffline) return m.key === 'cash'
                                    return m.key === null
                                      ? enabledPaymentMethods.includes('custom')
                                      : enabledPaymentMethods.includes(m.key as PosPaymentMethod)
                                  })
                                  .map((m) => (
                                    <option key={m.id} value={m.id}>
                                      {m.name}
                                    </option>
                                  ))
                              : Object.entries(PAYMENT_LABELS)
                                  .filter(([v]) => {
                                    if (isOffline) return v === 'cash'
                                    return enabledPaymentMethods.includes(v as PosPaymentMethod)
                                  })
                                  .map(([v, l]) => (
                                    <option key={v} value={v}>
                                      {l}
                                    </option>
                                  ))}
                          </select>
                          <ChevronDown
                            size={11}
                            className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-700"
                          />
                        </div>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          className="w-28 rounded-lg border border-purple-200 px-2 py-2 text-right font-mono text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                          placeholder="0.00"
                          value={p.amount === 0 ? '' : p.amount}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value)
                            updatePayment(i, { amount: isNaN(val) ? 0 : val })
                          }}
                        />
                        <button
                          aria-label="Remove payment method"
                          onClick={() => removePaymentRow(i)}
                          className="shrink-0 text-gray-500 hover:text-red-500"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </div>
                  )
                })}

                {/* Reference number / CR Number — a plain cash-mode sale
                    needs neither, unless this sale also has an inhouse
                    installment/down-payment component (mirrors the down
                    payment section below), in which case its cash-lines
                    payment gets a CR Number too. card/bank/e-wallet/etc.
                    (REF_METHODS) still always need their own reference,
                    installment or not — same as reserve mode. */}
                {payments.some(
                  (p) =>
                    (saleMode === 'sale' && inhouseInstallmentCartLines.length > 0) ||
                    REF_METHODS.includes(p.method) ||
                    p.refFieldLabel
                ) && (
                  <div className="mt-2 space-y-1.5">
                    {payments.map((p, i) => {
                      const needsRef =
                        (saleMode === 'sale' && inhouseInstallmentCartLines.length > 0) ||
                        REF_METHODS.includes(p.method) ||
                        p.refFieldLabel
                      const label =
                        p.refFieldLabel ??
                        (saleMode === 'sale'
                          ? 'CR Number'
                          : PAYMENT_LABELS[p.method]
                            ? `${PAYMENT_LABELS[p.method]} reference`
                            : 'Reference')
                      // An installment/down-payment sale requires a CR
                      // Number on the cash-lines payment regardless of
                      // method; otherwise sale mode falls back to the same
                      // REF_METHODS-only requirement as reserve mode
                      // (matches the same-scoped check at submit time).
                      const isRequired =
                        saleMode === 'sale'
                          ? inhouseInstallmentCartLines.length > 0 || REF_METHODS.includes(p.method)
                          : (p.refRequired ?? REF_METHODS.includes(p.method))
                      // Scenario 37 — POS Terminal (card) / Bank (bank_transfer) /
                      // Gateway (qr) all live in Item Payment Mode now (transaction-
                      // scoped, see hasCreditCardLine/hasCashLine) — not repeated
                      // here, just a pointer back so it doesn't read as missing.
                      const optionPointer =
                        p.method === 'card'
                          ? 'Terminal/Straight-Installment/Term'
                          : p.method === 'bank_transfer'
                            ? 'Bank'
                            : p.method === 'qr'
                              ? 'Gateway'
                              : null
                      return needsRef ? (
                        <div key={i} className="space-y-1.5">
                          <input
                            className="w-full rounded-lg border border-purple-200 bg-white px-3 py-1.5 text-xs text-gray-800 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                            placeholder={`${label}${isRequired ? ' *' : ''}`}
                            value={p.referenceNumber}
                            onChange={(e) => updatePayment(i, { referenceNumber: e.target.value })}
                          />
                          {optionPointer && (
                            <p className="text-[11px] text-gray-400">
                              {optionPointer} set via Payment Method above.
                            </p>
                          )}
                        </div>
                      ) : null
                    })}
                  </div>
                )}

                {saleMode === 'sale' && deliveryFeeAmount > 0 && (
                  <input
                    className="w-full rounded-lg border border-purple-200 bg-white px-3 py-1.5 text-xs text-gray-800 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                    placeholder="Delivery Fee Reference *"
                    value={deliveryFeeReferenceNumberInput}
                    onChange={(e) => setDeliveryFeeReferenceNumberInput(e.target.value)}
                  />
                )}

                {/* Loyalty points balance indicator */}
                {loyaltyPaymentRow && loyaltyPaymentRow.amount > 0 && loyaltyAccount && (
                  <div
                    className={`mt-2 rounded-lg px-3 py-1.5 text-xs ${loyaltyOverBalance ? 'bg-red-50 text-red-600' : 'bg-purple-200 text-purple-700'}`}
                  >
                    {loyaltyOverBalance
                      ? `Insufficient — need ${loyaltyPointsNeeded} pts, have ${loyaltyAccount.currentPoints} pts`
                      : `Redeeming ~${loyaltyPointsNeeded} pts · Balance: ${loyaltyAccount.currentPoints} pts`}
                  </div>
                )}
              </div>
            )}

            {/* Totals */}
            {(saleMode === 'reserve' ? payments.length > 0 : tenderTarget > 0) &&
              payments.length > 0 && (
                <div className="mt-4 space-y-1.5 border-t border-purple-200 pt-4 text-sm">
                  <div className="flex justify-between text-gray-700">
                    <span>{saleMode === 'reserve' ? 'Deposit Tendered' : 'Total Tendered'}</span>
                    <span className="font-mono font-medium text-gray-700">{fmt(totalPaid)}</span>
                  </div>
                  {saleMode === 'reserve' ? (
                    reserveBalance > 0.009 && (
                      <div className="flex items-center justify-between rounded-lg bg-gray-200 px-3 py-2 text-gray-700">
                        <span>Remaining at fulfilment</span>
                        <span className="font-mono">{fmt(reserveBalance)}</span>
                      </div>
                    )
                  ) : (
                    <>
                      {change > 0.009 && (
                        <div className="flex items-center justify-between rounded-lg bg-green-50 px-3 py-2 font-bold text-green-700">
                          <span>Change</span>
                          <span className="font-mono">{fmt(change)}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
          </div>

          {/* Confirm */}
          <div className="border-t border-purple-200 p-5">
            {error && (
              <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                <p>{error}</p>
              </div>
            )}
            {(() => {
              const anySerialMissing = cart.some(
                (l) =>
                  (l.isSerialTracked && !l.serialNumberId) ||
                  (l.requiresSecondarySerial && !l.secondarySerialNumberId)
              )
              const anyInstallmentMissingTerm = inhouseInstallmentCartLines.some(
                (l) => !l.financingTermId
              )
              const installmentMissingCreditApplication =
                inhouseInstallmentCartLines.length > 0 && !creditApplicationId
              const tpfMissingReference =
                tpfInstallmentCartLines.length > 0 && (!tpfProviderId || !tpfReferenceNumber.trim())
              const tpfMissingDownPayment = tpfInstallmentCartLines.some(
                (l) => !(parseFloat(l.downPaymentInput ?? '0') > 0)
              )
              const allCharge = cart.length > 0 && chargeCartLines.length === cart.length
              const allInstallment = cart.length > 0 && installmentCartLines.length === cart.length

              // Only truly non-actionable states stay disabled — everything
              // else is clickable so the cashier gets a specific error
              // message (via handleConfirm's own pre-flight checks) instead
              // of a silently-inert button with nothing but a small label
              // hinting at what's wrong.
              const disabled = submitting || cart.length === 0 || !sessionId

              const label = submitting
                ? 'Processing…'
                : cart.length === 0
                  ? 'Add items to continue'
                  : anySerialMissing
                    ? 'Select serial numbers to continue'
                    : saleMode === 'reserve' && !selectedCustomer
                      ? 'Select a customer to reserve'
                      : saleMode === 'reserve' && cart.length !== 1
                        ? 'Add one item to reserve'
                        : saleMode === 'sale' && hasChargeOrInstallmentLine && !selectedCustomer
                          ? 'Select a customer for this cart'
                          : saleMode === 'sale' && anyInstallmentMissingTerm
                            ? 'Select a financing term for every installment item'
                            : saleMode === 'sale' && installmentMissingCreditApplication
                              ? 'Select an approved credit application'
                              : saleMode === 'sale' &&
                                  installmentCartLines.length > 0 &&
                                  !installmentPaymentMethod
                                ? 'Choose a down payment method'
                                : saleMode === 'sale' && tpfMissingReference
                                  ? 'Select a TPF provider and enter a reference number'
                                  : saleMode === 'sale' && tpfMissingDownPayment
                                    ? 'Enter the down payment for the TPF-financed item(s)'
                                    : saleMode === 'sale' &&
                                        !hasChargeOrInstallmentLine &&
                                        !selectedCustomer
                                      ? 'Select a customer'
                                      : saleMode === 'sale' && balance > 0.009
                                        ? `Underpaid by ${fmt(balance)}`
                                        : saleMode === 'sale' && loyaltyOverBalance
                                          ? 'Insufficient loyalty points'
                                          : needsManagerOverride && !managerOverrideApproved
                                            ? 'Manager override required'
                                            : cart.some((l) => l.isSerialTracked)
                                              ? 'Submit for Approval'
                                              : saleMode === 'reserve'
                                                ? `Reserve Item${totalPaid > 0 ? ` — Deposit ${fmt(totalPaid)}` : ''}`
                                                : allCharge
                                                  ? 'Issue Charge Invoice'
                                                  : allInstallment
                                                    ? 'Create Installment Plan'
                                                    : 'Confirm Sale'

              const colorClass =
                saleMode === 'reserve'
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : allInstallment
                    ? 'bg-prominent-purple-700 hover:bg-prominent-purple-800'
                    : allCharge
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : 'bg-purple-700 hover:bg-purple-800'

              return (
                <button
                  onClick={handleConfirm}
                  disabled={disabled}
                  className={`w-full rounded-xl py-4 text-sm font-bold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.99] ${colorClass}`}
                >
                  {label}
                </button>
              )
            })()}
          </div>
        </div>
      </div>

      {/* Park Sale Modal */}
      {showParkModal && (
        <Overlay onClose={() => setShowParkModal(false)}>
          <h2 className="mb-1 text-lg font-bold text-gray-900">Park Sale</h2>
          <p className="mb-4 text-sm text-gray-500">
            Save this cart to resume later on the same terminal.
          </p>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Label</label>
            <input
              autoFocus
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
              placeholder="e.g. Customer waiting on size"
              value={parkLabel}
              onChange={(e) => setParkLabel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleParkSale()}
            />
          </div>
          <div className="mt-4 flex justify-end gap-3">
            <button
              onClick={() => setShowParkModal(false)}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleParkSale}
              disabled={!parkLabel.trim() || parking}
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
            >
              {parking ? 'Parking…' : 'Park Sale'}
            </button>
          </div>
        </Overlay>
      )}

      {/* Cancel Sale Modal */}
      {showCancelModal && (
        <Overlay
          onClose={() => {
            setShowCancelModal(false)
            setCancelError('')
          }}
        >
          <h2 className="mb-1 text-lg font-bold text-gray-900">Cancel Sale</h2>
          <p className="mb-4 text-sm text-gray-500">
            State your grounds for cancellation. A manager must approve before the cart is cleared.
          </p>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">
              Grounds for Cancellation <span className="text-red-500">*</span>
            </label>
            <textarea
              autoFocus
              rows={3}
              className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
              placeholder="e.g. Customer changed their mind before payment"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
          </div>
          {cancelError && (
            <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
              {cancelError}
            </p>
          )}
          <div className="mt-4 flex justify-end gap-3">
            <button
              onClick={() => {
                setShowCancelModal(false)
                setCancelError('')
              }}
              disabled={cancelSubmitting}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40"
            >
              Go Back
            </button>
            <button
              onClick={handleRequestCancellation}
              disabled={!cancelReason.trim() || cancelSubmitting}
              className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {cancelSubmitting ? (
                <>
                  <Loader2 size={13} className="animate-spin" /> Submitting…
                </>
              ) : (
                'Request Cancellation'
              )}
            </button>
          </div>
        </Overlay>
      )}

      {/* New Customer Modal */}
      {showNewCustomerModal && (
        <NewCustomerModal
          onClose={() => setShowNewCustomerModal(false)}
          onCreated={selectCustomer}
        />
      )}

      {/* Manager Override Dialog */}
      {showOverrideDialog && (
        <Overlay
          onClose={() => {
            setShowOverrideDialog(false)
            setOverrideError('')
          }}
        >
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
              <KeyRound size={18} className="text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Manager Override</h2>
              <p className="text-xs text-gray-500">
                Discount {discountPct.toFixed(0)}% exceeds the {discountThreshold}% threshold.
              </p>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">Manager PIN</label>
              <input
                autoFocus
                type="password"
                inputMode="numeric"
                maxLength={6}
                className="input font-mono tracking-widest"
                placeholder="••••"
                value={overridePin}
                onChange={(e) => setOverridePin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={(e) => e.key === 'Enter' && handleManagerOverride()}
              />
            </div>
          </div>
          {overrideError && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {overrideError}
            </p>
          )}
          <div className="mt-5 flex justify-end gap-3">
            <button
              onClick={() => {
                setShowOverrideDialog(false)
                setOverrideError('')
              }}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleManagerOverride}
              disabled={overridePending || !overridePin.trim()}
              className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
            >
              <ShieldCheck size={14} />
              {overridePending ? 'Verifying…' : 'Approve Override'}
            </button>
          </div>
        </Overlay>
      )}

      {priceOverrideTargetLineId &&
        (() => {
          const targetLine = cart.find((l) => l.lineId === priceOverrideTargetLineId)
          if (!targetLine) return null
          return (
            <PriceOverrideDialog
              itemName={targetLine.itemName}
              currentPrice={targetLine.priceResolved ? targetLine.unitPrice : null}
              onClose={() => setPriceOverrideTargetLineId(null)}
              onApprove={(result) => handlePriceOverrideApprove(targetLine.lineId, result)}
            />
          )
        })()}

      {/* Serial Number Picker */}
      {serialPickerTarget &&
        (() => {
          const targetLine = cart.find((l) => l.lineId === serialPickerTarget.lineId)
          const isSecondaryStage = serialPickerStage === 'secondary'
          const selectedId = isSecondaryStage
            ? targetLine?.secondarySerialNumberId
            : targetLine?.serialNumberId
          // A serial already assigned to a SIBLING line of the same item
          // (multiple units of one item in this cart, see addUnitOfItem)
          // can't be picked again for this line — same physical unit,
          // can't be sold twice in the same sale.
          const siblingUsedSerialIds = new Set(
            cart
              .filter(
                (l) =>
                  l.itemId === serialPickerTarget.itemId && l.lineId !== serialPickerTarget.lineId
              )
              .flatMap(
                (l) => [l.serialNumberId, l.secondarySerialNumberId].filter(Boolean) as string[]
              )
          )
          // The primary serial can't also be picked as the secondary — hide it
          // from the secondary list (backend enforces distinctness regardless).
          const visibleSerials = serialNumbers
            .filter((sn) => !isSecondaryStage || sn.id !== targetLine?.serialNumberId)
            .filter((sn) => !siblingUsedSerialIds.has(sn.id))
            .filter((sn) =>
              serialSearchQuery.trim()
                ? sn.serialNumber.toLowerCase().includes(serialSearchQuery.trim().toLowerCase())
                : true
            )

          // "Also available elsewhere" — informational only, never selectable
          // here (only a Request click can act on it). Collapsed to a count
          // per branch by default so a single unit doesn't dominate the
          // view; expanding a branch reveals its individual serials, each
          // independently requestable, for when the specific unit matters.
          // The branch-row list itself still needs its own bounded scroll —
          // an item in stock at most of the company's branches previously
          // rendered every single one, unbounded, dwarfing the rest of the
          // picker (same max-h-56/overflow-y-auto treatment as "In this
          // branch" above). Excludes anything already shown in
          // visibleSerials above (a serial physically in this branch
          // appears in both fetches).
          const ownIds = new Set(serialNumbers.map((sn) => sn.id))
          const elsewhereByBranch = elsewhereSerials
            .filter((sn) => !ownIds.has(sn.id))
            .filter((sn) => !siblingUsedSerialIds.has(sn.id))
            .filter((sn) =>
              serialSearchQuery.trim()
                ? sn.serialNumber.toLowerCase().includes(serialSearchQuery.trim().toLowerCase())
                : true
            )
            .reduce<Record<string, SerialNumberRecord[]>>((groups, sn) => {
              const branchLabel = sn.currentWarehouse?.name ?? 'Another branch'
              groups[branchLabel] = [...(groups[branchLabel] ?? []), sn]
              return groups
            }, {})

          function requestSerial(sn: SerialNumberRecord) {
            if (!sn.currentWarehouseId) return
            setPendingStockRequest(sn)
          }

          function toggleBranch(branchLabel: string) {
            setExpandedBranch((prev) => (prev === branchLabel ? null : branchLabel))
          }

          function pick(sn: SerialNumberRecord) {
            if (isSecondaryStage) {
              setCart((prev) =>
                prev.map((l) =>
                  l.lineId === serialPickerTarget!.lineId
                    ? {
                        ...l,
                        secondarySerialNumberId: sn.id,
                        secondarySerialNumberLabel: sn.serialNumber,
                      }
                    : l
                )
              )
              setSerialPickerTarget(null)
              setSerialPickerStage('primary')
              return
            }
            setCart((prev) =>
              prev.map((l) =>
                l.lineId === serialPickerTarget!.lineId
                  ? { ...l, serialNumberId: sn.id, serialNumberLabel: sn.serialNumber }
                  : l
              )
            )
            if (targetLine?.requiresSecondarySerial) {
              setSerialPickerStage('secondary')
            } else {
              setSerialPickerTarget(null)
            }
          }

          const hasElsewhere = Object.keys(elsewhereByBranch).length > 0
          const expandedSerials = expandedBranch ? (elsewhereByBranch[expandedBranch] ?? []) : []

          return (
            <Overlay
              dismissible={false}
              width={expandedBranch ? 'xl' : 'lg'}
              onClose={() => {
                setSerialPickerTarget(null)
                setSerialPickerStage('primary')
              }}
            >
              <div className="flex gap-5">
                <div className="min-w-0 flex-1">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-100">
                      <Tag size={18} className="text-purple-600" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-gray-900">
                        {isSecondaryStage ? 'Select Outdoor Unit Serial' : 'Select Serial Number'}
                      </h2>
                      <p className="text-xs text-gray-500">
                        {serialPickerTarget.itemName}
                        {isSecondaryStage && ' — Outdoor Unit'}
                      </p>
                    </div>
                  </div>
                  <div className="relative mb-4">
                    <Search
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                    <input
                      autoFocus
                      value={serialSearchQuery}
                      onChange={(e) => setSerialSearchQuery(e.target.value)}
                      placeholder="Search serial number…"
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-purple-400 focus:bg-white focus:ring-2 focus:ring-purple-100"
                    />
                  </div>

                  {hasElsewhere && (
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                      In this branch
                    </p>
                  )}
                  <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
                    {serialLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 size={20} className="animate-spin text-purple-400" />
                      </div>
                    ) : serialError ? (
                      <div className="rounded-lg bg-red-50 px-4 py-5 text-center text-sm text-red-700">
                        {serialError}
                      </div>
                    ) : visibleSerials.length === 0 ? (
                      <div className="rounded-lg bg-amber-50 px-4 py-5 text-center text-sm text-amber-700">
                        {serialSearchQuery
                          ? `No serial numbers match "${serialSearchQuery}".`
                          : 'No available serial numbers in stock for this item at this branch.'}
                      </div>
                    ) : (
                      visibleSerials.map((sn) => {
                        const isSelected = selectedId === sn.id
                        return (
                          <button
                            key={sn.id}
                            className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-colors ${
                              isSelected
                                ? 'border-purple-500 bg-purple-50'
                                : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50'
                            }`}
                            onClick={() => pick(sn)}
                          >
                            <span className="font-mono text-sm font-semibold text-gray-900">
                              {sn.serialNumber}
                            </span>
                            {isSelected && <CheckCircle2 size={14} className="text-purple-600" />}
                          </button>
                        )
                      })
                    )}
                  </div>

                  {hasElsewhere && (
                    <div className="mt-4 border-t border-gray-100 pt-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                        Also available elsewhere
                      </p>
                      <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
                        {Object.entries(elsewhereByBranch).map(([branchLabel, serials]) => {
                          const isActive = expandedBranch === branchLabel
                          return (
                            <button
                              key={branchLabel}
                              onClick={() => toggleBranch(branchLabel)}
                              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors ${
                                isActive
                                  ? 'bg-purple-50 ring-1 ring-purple-300'
                                  : 'bg-gray-50 hover:bg-gray-100'
                              }`}
                            >
                              <Building2 size={14} className="shrink-0 text-gray-400" />
                              <span
                                title={branchLabel}
                                className="min-w-0 flex-1 truncate text-sm text-gray-600"
                              >
                                {branchLabel}
                              </span>
                              <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-600">
                                {serials.length} in stock
                              </span>
                              <ChevronRight
                                size={14}
                                className={`shrink-0 text-gray-400 transition-transform ${isActive ? 'rotate-180' : ''}`}
                              />
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {expandedBranch && (
                  <div className="w-56 shrink-0 border-l border-gray-100 pl-5">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p
                        title={expandedBranch}
                        className="min-w-0 truncate text-xs font-semibold uppercase tracking-wide text-gray-400"
                      >
                        {expandedBranch}
                      </p>
                      <button
                        onClick={() => setExpandedBranch(null)}
                        className="shrink-0 text-gray-400 hover:text-gray-700"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <div className="max-h-88 space-y-1.5 overflow-y-auto pr-1">
                      {expandedSerials.map((sn) => {
                        const status = serialRequestStatus[sn.id]
                        return (
                          <div
                            key={sn.id}
                            className="flex flex-col gap-1.5 rounded-lg bg-gray-50 px-2.5 py-2"
                          >
                            <span
                              title="Not sellable from this branch"
                              className="cursor-not-allowed font-mono text-xs text-gray-500"
                            >
                              {sn.serialNumber}
                            </span>
                            {status === 'requested' ? (
                              <span className="flex items-center gap-1 text-xs font-semibold text-green-600">
                                <CheckCircle2 size={12} /> Requested
                              </span>
                            ) : (
                              <button
                                onClick={() => requestSerial(sn)}
                                disabled={status === 'loading'}
                                className="flex items-center justify-center gap-1 rounded-lg border border-purple-200 bg-white px-2 py-1 text-xs font-medium text-purple-700 hover:bg-purple-50 disabled:opacity-50"
                              >
                                {status === 'loading' ? (
                                  <Loader2 size={11} className="animate-spin" />
                                ) : (
                                  <Send size={11} />
                                )}
                                {status === 'error' ? 'Retry' : 'Request'}
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    {Object.values(serialRequestStatus).includes('error') && (
                      <p className="mt-1.5 text-xs text-red-600">Couldn't raise the request.</p>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-4 flex justify-end border-t border-gray-100 pt-4">
                <button
                  onClick={() => {
                    // Closing on a unit that never got a serial (a fresh
                    // add-another-unit, or a brand-new item) discards that
                    // line entirely — otherwise it's left stranded in the
                    // cart needing a serial with no obvious way back in.
                    // A line that already HAD a serial (reopened to change
                    // it) is left untouched either way.
                    if (targetLine && !targetLine.serialNumberId) {
                      removeCartLine(targetLine.lineId)
                    }
                    setSerialPickerTarget(null)
                    setSerialPickerStage('primary')
                  }}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </Overlay>
          )
        })()}

      {pendingStockRequest && (
        <Overlay onClose={() => setPendingStockRequest(null)} dim="strong">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-purple-700">
              <Send size={19} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Request this unit?</h2>
              <p className="text-sm text-gray-600">
                Raises a stock transfer request to another branch
              </p>
            </div>
          </div>
          <div className="overflow-hidden rounded-xl border border-gray-200">
            <div className="bg-gray-50 px-4 py-3 text-sm text-gray-900">
              Serial{' '}
              <span className="font-mono font-semibold">{pendingStockRequest.serialNumber}</span>{' '}
              from{' '}
              <span className="font-semibold">
                {pendingStockRequest.currentWarehouse?.name ?? 'another branch'}
              </span>
            </div>
            <div className="flex gap-2.5 border-t border-gray-200 bg-white px-4 py-3">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
              <p className="text-sm text-gray-700">
                Make sure this is the unit you meant to pick — this notifies the source branch and
                can't be undone from here.
              </p>
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-3">
            <button
              onClick={() => setPendingStockRequest(null)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                const sn = pendingStockRequest
                setPendingStockRequest(null)
                void confirmStockRequest(sn)
              }}
              className="flex items-center gap-2 rounded-lg bg-purple-700 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-800"
            >
              <Send size={14} /> Request Unit
            </button>
          </div>
        </Overlay>
      )}

      {/* Measured-item quantity picker */}
      {measuredItem &&
        (() => {
          const parsedQty = parseFloat(measuredQtyInput)
          const validQty = !isNaN(parsedQty) && parsedQty > 0
          const liveTotal = validQty
            ? parsedQty * measuredItem.price * (1 + (measuredItem.taxRate ?? 0) / 100)
            : 0
          const uom = measuredItem.uomCode?.toUpperCase() ?? ''
          const presets = [0.1, 0.25, 0.5, 1]
          const availableStock = measuredItem.stockQty
          const noStock = availableStock !== undefined && availableStock <= 0
          const exceedsStock =
            availableStock !== undefined && validQty && parsedQty > availableStock

          return (
            <Overlay
              onClose={() => {
                setMeasuredItem(null)
                setMeasuredQtyInput('')
              }}
            >
              {/* Item info */}
              <div className="mb-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-purple-500">
                      {uom || 'Measured Item'}
                    </p>
                    <h2 className="mt-0.5 text-lg font-bold text-gray-900">{measuredItem.name}</h2>
                    <p className="text-sm text-gray-500">
                      {fmt(measuredItem.price * (1 + (measuredItem.taxRate ?? 0) / 100))} per{' '}
                      {uom || 'unit'}
                    </p>
                  </div>
                  {availableStock !== undefined && (
                    <div
                      className={`rounded-lg px-2.5 py-1 text-right text-xs font-semibold ${noStock ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}
                    >
                      <p className="text-[10px] font-normal opacity-70">In stock</p>
                      <p>
                        {availableStock} {uom}
                      </p>
                    </div>
                  )}
                </div>
                {noStock && (
                  <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                    <AlertTriangle size={12} />
                    No stock at this location. Ensure stock has been received at this branch in
                    Inventory.
                  </div>
                )}
              </div>

              {/* Quick presets */}
              <div className="mb-3 grid grid-cols-4 gap-2">
                {presets.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setMeasuredQtyInput(String(p))}
                    className={`rounded-lg border py-2 text-sm font-semibold transition-colors ${
                      measuredQtyInput === String(p)
                        ? 'border-purple-500 bg-purple-50 text-purple-700'
                        : 'border-gray-200 text-gray-600 hover:border-purple-300 hover:bg-purple-50'
                    }`}
                  >
                    {p} {uom}
                  </button>
                ))}
              </div>

              {/* Manual input */}
              <div className="relative">
                <input
                  autoFocus
                  type="number"
                  min="0.001"
                  step="0.01"
                  className="w-full rounded-lg border border-gray-200 px-3 py-3 pr-16 text-center text-2xl font-bold text-gray-900 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  placeholder="0.00"
                  value={measuredQtyInput}
                  onChange={(e) => setMeasuredQtyInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && validQty) {
                      addToCart(measuredItem, parsedQty)
                      setMeasuredItem(null)
                      setMeasuredQtyInput('')
                    }
                  }}
                />
                {uom && (
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">
                    {uom}
                  </span>
                )}
              </div>

              {/* Live total */}
              <div
                className={`mt-3 rounded-lg px-4 py-3 text-center transition-colors ${validQty ? 'bg-purple-50' : 'bg-gray-50'}`}
              >
                <p className="text-xs text-gray-500">Total</p>
                <p
                  className={`text-2xl font-bold ${validQty ? 'text-purple-700' : 'text-gray-300'}`}
                >
                  {validQty ? fmt(liveTotal) : '—'}
                </p>
              </div>

              {exceedsStock && (
                <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  <AlertTriangle size={12} />
                  Requested {parsedQty} {uom} exceeds available stock ({availableStock} {uom}).
                </div>
              )}

              {/* Actions */}
              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => {
                    setMeasuredItem(null)
                    setMeasuredQtyInput('')
                  }}
                  className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (!validQty) return
                    addToCart(measuredItem, parsedQty)
                    setMeasuredItem(null)
                    setMeasuredQtyInput('')
                  }}
                  disabled={!validQty}
                  className="flex-1 rounded-lg bg-purple-700 py-2.5 text-sm font-bold text-white hover:bg-purple-800 disabled:opacity-40"
                >
                  Add to Cart
                </button>
              </div>
            </Overlay>
          )
        })()}
    </div>
  )
}

// ─── Success Screen ───────────────────────────────────────────────────────────

function SuccessScreen({
  success,
  totalAmount,
  selectedCustomer,
  onReset,
  fmt,
  customerDisplayName,
  cart,
  payments,
  promoDiscount,
  activeTaxRate,
  inclusivePricing,
}: {
  success: {
    transactionId: string
    transactionNumber: string
    change: number
    journalEntryId?: string | null
    arInvoiceId?: string | null
    salesInvoiceNumber?: string | null
    deliveryReceiptNumber?: string | null
    loyaltyEarned: boolean
    offlineBuffered?: boolean
    lineOutcomes: {
      lineId: string
      itemName: string
      invoiceType: PosInvoiceType
      installmentProvider?: InstallmentProvider | null
      installmentPreview?: InstallmentPreview | null
      /** TPF lines only — what the customer paid here vs. what the
       * financier funds. Inhouse lines carry theirs in installmentPreview. */
      downPayment?: number | null
      financedBalance?: number | null
    }[]
    invoices?: PosTransactionInvoice[]
  }
  totalAmount: number
  selectedCustomer: PosCustomer | null
  onReset: () => void
  fmt: (n: number) => string
  customerDisplayName: (c: PosCustomer) => string
  cart: CartLine[]
  payments: PaymentRow[]
  promoDiscount: number
  activeTaxRate: { rate: number; name: string } | null
  inclusivePricing: boolean
}) {
  const { branchName } = usePosBranchContext()
  const [branding, setBranding] = useState<{
    receiptLogoUrl: string | null
    receiptHeaderText: string | null
  } | null>(null)

  useEffect(() => {
    getReceiptBranding().then((res) => {
      if (res.success && res.data) setBranding(res.data)
    })
  }, [])

  const headerLines = (branding?.receiptHeaderText ?? '').split('\n').filter(Boolean)

  const receiptDate = new Date().toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  const chargeOutcomes = success.lineOutcomes.filter((l) => l.invoiceType === 'charge')
  const installmentOutcomes = success.lineOutcomes.filter((l) => l.invoiceType === 'installment')
  const hasChargeOrInstallment = chargeOutcomes.length > 0 || installmentOutcomes.length > 0
  const allCharge =
    success.lineOutcomes.length > 0 && chargeOutcomes.length === success.lineOutcomes.length
  const allInstallment =
    success.lineOutcomes.length > 0 && installmentOutcomes.length === success.lineOutcomes.length

  // What this register actually took: everything tendered, less the change
  // handed back. On a financed or charged sale that is nowhere near the sale
  // total — a financier or the customer's own account carries the rest — so
  // the receipt has to lead with the collected figure rather than imply the
  // customer paid the lot.
  const totalTendered = Math.round(payments.reduce((s, p) => s + (p.amount || 0), 0) * 100) / 100
  const paidNow = Math.max(0, Math.round((totalTendered - success.change) * 100) / 100)
  const notCollectedHere = Math.max(0, Math.round((totalAmount - paidNow) * 100) / 100)
  const tpfOutcomes = installmentOutcomes.filter((o) => o.installmentProvider === 'tpf')
  const allTpf = tpfOutcomes.length > 0 && tpfOutcomes.length === installmentOutcomes.length
  const allInhouse = installmentOutcomes.length > 0 && tpfOutcomes.length === 0
  const notCollectedLabel =
    chargeOutcomes.length > 0 && installmentOutcomes.length === 0
      ? 'Billed to account'
      : chargeOutcomes.length > 0
        ? 'Financed / billed to account'
        : allTpf
          ? 'Financed by third party'
          : allInhouse
            ? 'Financed on installment'
            : 'Financed / billed to account'
  const headlineAmount = notCollectedHere > 0 ? paidNow : totalAmount
  // Worth spelling out only when the cash handed over isn't the headline
  // figure — otherwise it just repeats the number directly above it.
  const showTendered = totalTendered > 0 && Math.abs(totalTendered - headlineAmount) >= 0.01

  const borderColor = success.offlineBuffered
    ? 'border-amber-200'
    : allCharge
      ? 'border-blue-100'
      : allInstallment
        ? 'border-prominent-purple-100'
        : 'border-green-100'

  const iconBg = success.offlineBuffered
    ? 'bg-amber-100'
    : allCharge
      ? 'bg-blue-100'
      : allInstallment
        ? 'bg-prominent-purple-100'
        : 'bg-green-100'

  return (
    <div className="flex min-h-full items-start justify-center bg-zinc-50 p-6">
      <div className="w-full max-w-sm">
        <div className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${borderColor}`}>
          {/* Branding header */}
          <div className="flex flex-col items-center gap-2 border-b border-gray-100 px-6 py-5">
            {branding?.receiptLogoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={branding.receiptLogoUrl}
                alt="logo"
                className="h-10 w-auto max-w-28 object-contain"
              />
            )}
            {headerLines.length > 0 && (
              <div className="flex flex-col items-center gap-0.5">
                {headerLines.map((line, i) => (
                  <p key={i} className="text-xs font-medium text-gray-700">
                    {line}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Icon + title */}
          <div className="flex flex-col items-center gap-3 px-8 pb-4 pt-6">
            <div className={`flex h-14 w-14 items-center justify-center rounded-full ${iconBg}`}>
              {success.offlineBuffered ? (
                <WifiOff size={28} className="text-amber-600" />
              ) : hasChargeOrInstallment ? (
                <Receipt
                  size={28}
                  className={allInstallment ? 'text-prominent-purple-600' : 'text-blue-600'}
                />
              ) : (
                <CheckCircle2 size={28} className="text-green-600" />
              )}
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-gray-900">
                {success.offlineBuffered
                  ? 'Sale Buffered (Offline)'
                  : allCharge
                    ? 'Charge Invoice Issued'
                    : allInstallment
                      ? 'Installment Plan Created'
                      : hasChargeOrInstallment
                        ? 'Sale Complete — Mixed'
                        : 'Sale Complete'}
              </p>
              {success.offlineBuffered ? (
                <p className="mt-1 text-sm text-amber-600">Will sync automatically when online.</p>
              ) : hasChargeOrInstallment ? (
                <p className="mt-1 text-sm text-blue-500">
                  {chargeOutcomes.length > 0 &&
                    `${chargeOutcomes.length} item${chargeOutcomes.length !== 1 ? 's' : ''} billed to account`}
                  {chargeOutcomes.length > 0 && installmentOutcomes.length > 0 && ' · '}
                  {installmentOutcomes.length > 0 &&
                    `${installmentOutcomes.length} item${installmentOutcomes.length !== 1 ? 's' : ''} on installment`}
                </p>
              ) : null}
            </div>
          </div>

          {installmentOutcomes.length > 0 && (
            <div className="space-y-2 px-6 pb-4">
              {installmentOutcomes.map((o) => (
                <div
                  key={o.lineId}
                  className="rounded-xl bg-prominent-purple-50 px-4 py-3 text-xs text-prominent-purple-700"
                >
                  <p className="mb-1 font-semibold">
                    {o.itemName}
                    <span className="ml-1.5 font-normal opacity-70">
                      · {o.installmentProvider === 'tpf' ? 'TPF' : 'Inhouse'}
                    </span>
                  </p>
                  {o.installmentProvider === 'tpf' ? (
                    <>
                      <div className="flex justify-between">
                        <span>Down Payment</span>
                        <span className="font-mono font-semibold">{fmt(o.downPayment ?? 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Financed by Third Party</span>
                        <span className="font-mono font-semibold">
                          {fmt(o.financedBalance ?? 0)}
                        </span>
                      </div>
                      <span className="opacity-70">
                        No local schedule — the financier owns the amortization.
                      </span>
                    </>
                  ) : o.installmentPreview ? (
                    <>
                      <div className="flex justify-between">
                        <span>Monthly Installment</span>
                        <span className="font-mono font-semibold">
                          {fmt(o.installmentPreview.monthlyInstallment)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Payable</span>
                        <span className="font-mono font-semibold">
                          {fmt(o.installmentPreview.totalPayable)}
                        </span>
                      </div>
                    </>
                  ) : (
                    <span className="opacity-70">Preview unavailable.</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Sale details */}
          <div className="space-y-1 border-t border-dashed border-gray-200 px-6 py-3">
            {branchName && (
              <div className="flex justify-between text-[11px] text-gray-500">
                <span>Branch</span>
                <span className="text-right font-medium text-gray-700">{branchName}</span>
              </div>
            )}
            {selectedCustomer && (
              <div className="flex justify-between gap-2 text-[11px] text-gray-500">
                <span className="shrink-0">Customer</span>
                <span className="text-right font-medium text-gray-700">
                  {customerDisplayName(selectedCustomer)}
                </span>
              </div>
            )}
            <div className="flex justify-between text-[11px] text-gray-500">
              <span>Date</span>
              <span>{receiptDate}</span>
            </div>
            <div className="flex items-start justify-between gap-2 text-[11px] text-gray-500">
              <span className="shrink-0">TXN #</span>
              <span className="break-all text-right font-mono text-[10px]">
                {success.transactionNumber}
              </span>
            </div>
            {success.salesInvoiceNumber && (
              <div className="flex items-start justify-between gap-2 text-[11px] text-gray-500">
                <span className="shrink-0">SI #</span>
                <span className="break-all text-right font-mono text-[10px]">
                  {success.salesInvoiceNumber}
                </span>
              </div>
            )}
            {success.deliveryReceiptNumber && (
              <div className="flex items-start justify-between gap-2 text-[11px] text-gray-500">
                <span className="shrink-0">DR #</span>
                <span className="break-all text-right font-mono text-[10px]">
                  {success.deliveryReceiptNumber}
                </span>
              </div>
            )}
            {/* Installment terms bill one invoice per due date, all created
                at sale time — only the first (the plan's reference number)
                belongs on the receipt, not every future month's. */}
            {(success.invoices ?? [])
              .filter((inv) => inv.lineNumber === null || inv.lineNumber === 1)
              .map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-start justify-between gap-2 text-[11px] text-gray-500"
                >
                  <span className="shrink-0">Invoice #</span>
                  <span className="break-all text-right font-mono text-[10px]">
                    {inv.invoiceNumber}
                  </span>
                </div>
              ))}
          </div>

          {/* Items */}
          <div className="space-y-2.5 border-t border-dashed border-gray-200 px-6 py-3">
            {cart.map((line) => {
              const displayUnitPrice = displayUnitPriceWithTax(
                line,
                activeTaxRate,
                inclusivePricing
              )
              const displayLineTotal = displayUnitPrice * line.quantity
              return (
                <div key={line.lineId} className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-medium text-gray-800">
                      {itemDisplayLabel({
                        name: line.itemName,
                        brandName: line.brandName,
                        categoryName: line.categoryName,
                        modelNumber: line.modelNumber,
                      })}
                    </p>
                    {line.serialNumberLabel && (
                      <p className="truncate text-[10px] text-gray-400">
                        SN: {line.serialNumberLabel}
                      </p>
                    )}
                    <p className="text-[10px] text-gray-400">
                      {line.quantity} × {fmt(displayUnitPrice)}
                    </p>
                  </div>
                  <p className="shrink-0 text-[11px] font-semibold text-gray-900">
                    {fmt(displayLineTotal)}
                  </p>
                </div>
              )
            })}
          </div>

          {/* Payments */}
          <div className="space-y-1.5 border-t border-dashed border-gray-200 px-6 py-3">
            {payments
              .filter((p) => p.amount > 0)
              .map((p, i) => (
                <div key={i} className="text-[11px] text-gray-500">
                  <div className="flex justify-between">
                    <span>{PAYMENT_LABELS[p.method] ?? p.method}</span>
                    <span>{fmt(p.amount)}</span>
                  </div>
                  {p.referenceNumber && (
                    <div className="text-right text-[10px] text-gray-400">
                      CR# {p.referenceNumber}
                    </div>
                  )}
                </div>
              ))}
            {promoDiscount > 0 && (
              <div className="flex justify-between text-[11px] text-green-600">
                <span>Discount</span>
                <span>−{fmt(promoDiscount)}</span>
              </div>
            )}
          </div>

          {/* What was collected here — with the sale total and the part
              nobody paid at this register spelled out above it whenever the
              two differ. */}
          <div className="border-t border-gray-100 bg-gray-50 px-6 py-4 text-center">
            {notCollectedHere > 0 && (
              <div className="mb-3 space-y-1">
                <div className="flex justify-between text-[11px] text-gray-500">
                  <span>Sale total</span>
                  <span className="font-medium text-gray-700">{fmt(totalAmount)}</span>
                </div>
                <div className="flex justify-between text-[11px] text-gray-500">
                  <span>{notCollectedLabel}</span>
                  <span className="font-medium text-gray-700">−{fmt(notCollectedHere)}</span>
                </div>
              </div>
            )}
            <p className="text-sm text-gray-500">
              {notCollectedHere > 0 ? 'Paid Now' : 'Total Charged'}
            </p>
            <p className="text-3xl font-bold text-gray-900">{fmt(headlineAmount)}</p>
            {(showTendered || success.change > 0) && (
              <p className="mt-2 text-sm">
                {showTendered && (
                  <span className="text-gray-500">Tendered {fmt(totalTendered)}</span>
                )}
                {showTendered && success.change > 0 && <span className="text-gray-300"> · </span>}
                {success.change > 0 && (
                  <span className="font-medium text-green-600">Change: {fmt(success.change)}</span>
                )}
              </p>
            )}
          </div>

          {success.journalEntryId && (
            <p className="px-6 pt-3 text-center font-mono text-[10px] text-gray-400">
              JE: {success.journalEntryId}
            </p>
          )}
          {success.loyaltyEarned && selectedCustomer && (
            <p className="px-6 pt-2 text-center text-xs font-medium text-purple-500">
              Points earned for {customerDisplayName(selectedCustomer)}
            </p>
          )}

          <p className="px-6 py-4 text-center text-[10px] text-gray-400">
            Thank you for your purchase!
          </p>
        </div>

        <button
          onClick={onReset}
          className="mt-4 w-full rounded-xl bg-purple-700 px-8 py-3 text-sm font-bold text-white hover:bg-purple-800"
        >
          New Sale
        </button>
      </div>
    </div>
  )
}

// ─── Pending Approval Screen ───────────────────────────────────────────────────

/** Reuses the same window.open + window.print() pattern as
 * ReleaseApprovalsList.tsx::handlePrint — no server-side PDF generation,
 * just a styled, printable HTML document opened in a new tab. */
function handlePrintPromissoryNote(note: PromissoryNote, fmt: (n: number) => string) {
  const generatedDate = new Date(note.generatedAt).toLocaleString('en-PH')
  const signedDate = note.signedAt ? new Date(note.signedAt).toLocaleString('en-PH') : null

  const lineRows = note.scheduleLines
    .map(
      (l) =>
        `<tr><td>${l.lineNumber}</td><td>${new Date(l.dueDate).toLocaleDateString('en-PH')}</td><td style="text-align:right">${fmt(l.amount)}</td></tr>`
    )
    .join('')

  const html = `<!DOCTYPE html><html><head><title>PROMISSORY NOTE — ${note.id}</title>
<style>
  body{font-family:monospace;font-size:12px;max-width:420px;margin:0 auto;padding:16px}
  .banner{background:#000;color:#fff;text-align:center;padding:6px 0;font-size:14px;font-weight:bold;letter-spacing:2px;margin-bottom:10px}
  .center{text-align:center;margin:3px 0;color:#555}
  hr{border:none;border-top:1px dashed #aaa;margin:8px 0}
  table{width:100%;border-collapse:collapse}
  th{text-align:left;font-size:11px;color:#888;padding:2px 4px}
  td{padding:3px 4px}
  .row{display:flex;justify-content:space-between;padding:2px 0}
  .sig{margin-top:24px}
  .sig-line{border-top:1px solid #333;margin-top:36px;padding-top:4px;font-size:10px;color:#666}
  .footer{text-align:center;font-size:10px;color:#aaa;margin-top:10px}
  @media print{.no-print{display:none}}
</style></head><body>
<div class="banner">PROMISSORY NOTE</div>
<p class="center" style="font-weight:bold">${note.id}</p>
<p class="center">Generated ${generatedDate}</p>
<hr>
<div class="row"><span>Financing term</span><span>${note.termMonths} months</span></div>
<div class="row"><span>Total amount</span><span>${fmt(note.totalAmount)}</span></div>
<div class="row"><span>Down payment</span><span>${fmt(note.downPayment)}</span></div>
<div class="row" style="font-weight:bold"><span>Amount financed</span><span>${fmt(note.amountFinanced)}</span></div>
<div class="row" style="font-weight:bold"><span>Total payable</span><span>${fmt(note.totalPayable)}</span></div>
<div class="row"><span>Monthly installment</span><span>${fmt(note.monthlyInstallment)}</span></div>
<hr>
<table><thead><tr><th>#</th><th>Due date</th><th style="text-align:right">Amount</th></tr></thead><tbody>${lineRows}</tbody></table>
<hr>
<div class="row"><span>Status</span><span>${note.signedAt ? 'Signed' : 'Not yet signed'}</span></div>
${signedDate ? `<div class="row"><span>Signed at</span><span>${signedDate}</span></div>` : ''}
<div class="sig">
  <div class="sig-line">Applicant signature</div>
  <div class="sig-line">Co-maker signature</div>
</div>
<p class="footer">PROMISSORY NOTE. This document represents a binding commitment to pay per the schedule above.</p>
<button class="no-print" onclick="window.print()" style="display:block;margin:12px auto;padding:6px 20px;cursor:pointer;font-size:12px">Print</button>
</body></html>`

  const w = window.open('', '_blank', 'width=440,height=680,scrollbars=yes')
  if (w) {
    w.document.write(html)
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 400)
  }
}

function PendingApprovalScreen({
  releaseFormRequestId,
  totalAmount,
  serialLines,
  creditApplicationId,
  canSignPromissoryNote,
  onReset,
  fmt,
}: {
  releaseFormRequestId: string
  totalAmount: number
  serialLines: { itemName: string; serialNumberLabel?: string }[]
  creditApplicationId?: string
  canSignPromissoryNote: boolean
  onReset: () => void
  fmt: (n: number) => string
}) {
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState('')

  // Scenario 17 Part 7 — the Promissory Note(s) generated alongside this
  // hold (installment sales only) — one per installment line, so a cart
  // that mixed several financing terms gets several notes here. Cashier
  // prints each for the applicant/co-maker to sign, then marks the whole
  // set signed at once — release stays blocked until every note is signed.
  const [promissoryNotes, setPromissoryNotes] = useState<PromissoryNote[]>([])
  const [pnLoading, setPnLoading] = useState(!!creditApplicationId)
  const [signing, setSigning] = useState(false)
  const [signError, setSignError] = useState('')

  useEffect(() => {
    // creditApplicationId is fixed for the lifetime of this screen (set once
    // from the checkout submit response), so the initial pnLoading state
    // above already covers it — no need to set it true again here.
    if (!creditApplicationId) return
    getPromissoryNote(creditApplicationId).then((res) => {
      setPnLoading(false)
      if (res.success && res.data) setPromissoryNotes(res.data)
    })
  }, [creditApplicationId])

  async function handleCancelRequest() {
    setCancelling(true)
    setCancelError('')
    const res = await cancelReleaseFormRequest(releaseFormRequestId)
    setCancelling(false)
    if (!res.success) {
      setCancelError(res.error ?? 'Failed to cancel request.')
      return
    }
    onReset()
  }

  async function handleSignPromissoryNote() {
    if (!creditApplicationId) return
    setSigning(true)
    setSignError('')
    const res = await signPromissoryNote(creditApplicationId)
    setSigning(false)
    if (!res.success || !res.data) {
      setSignError(res.error ?? 'Failed to sign promissory note.')
      return
    }
    setPromissoryNotes(res.data)
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-zinc-50 p-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-5 rounded-2xl border border-amber-100 bg-white p-8 text-center shadow-sm">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
          <Clock size={28} className="text-amber-600" />
        </div>
        <div>
          <p className="text-xl font-bold text-gray-900">Pending Approval</p>
          <p className="mt-1 text-sm text-amber-600">
            Waiting for a Business Owner or Branch Manager to review.
          </p>
        </div>

        <div className="w-full space-y-2 rounded-xl bg-gray-50 px-5 py-4 text-left">
          {serialLines.map((line, i) => (
            <div key={i} className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate font-medium text-gray-800">{line.itemName}</span>
              <span className="shrink-0 font-mono text-xs text-gray-500">
                {line.serialNumberLabel ?? '—'}
              </span>
            </div>
          ))}
          <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2">
            <span className="text-sm font-semibold text-gray-700">Total</span>
            <span className="text-lg font-bold text-gray-900">{fmt(totalAmount)}</span>
          </div>
        </div>

        {creditApplicationId && (
          <div className="w-full space-y-2 rounded-xl border border-purple-100 bg-purple-50/50 px-5 py-4 text-left">
            <div className="flex items-center gap-2">
              <FileSignature size={15} className="text-purple-700" />
              <p className="text-sm font-semibold text-gray-800">
                Promissory Note{promissoryNotes.length > 1 ? 's' : ''}
              </p>
            </div>
            {pnLoading ? (
              <Skeleton className="h-8 w-full" />
            ) : promissoryNotes.length === 0 ? (
              <p className="text-xs text-gray-500">Not available yet.</p>
            ) : (
              <>
                {(() => {
                  const unsigned = promissoryNotes.filter((n) => !n.signedAt)
                  return (
                    <p className="text-xs text-gray-600">
                      {unsigned.length === 0 ? (
                        <span className="inline-flex items-center gap-1 font-medium text-green-700">
                          <CheckCircle2 size={12} /> Signed
                        </span>
                      ) : (
                        'Print for the applicant and co-maker to sign, then mark it signed below — release is blocked until then.'
                      )}
                    </p>
                  )
                })()}
                <div className="space-y-1.5">
                  {promissoryNotes.map((note, i) => (
                    <div key={note.id} className="flex items-center justify-between gap-2">
                      {promissoryNotes.length > 1 && (
                        <span className="shrink-0 text-[11px] text-gray-500">
                          Line {i + 1}
                          {note.signedAt && (
                            <CheckCircle2 size={11} className="ml-1 inline text-green-700" />
                          )}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handlePrintPromissoryNote(note, fmt)}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
                      >
                        <Printer size={13} /> Print
                      </button>
                    </div>
                  ))}
                  {promissoryNotes.some((n) => !n.signedAt) && canSignPromissoryNote && (
                    <button
                      type="button"
                      onClick={handleSignPromissoryNote}
                      disabled={signing}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-purple-700 px-3 py-2 text-xs font-bold text-white hover:bg-purple-800 disabled:opacity-50"
                    >
                      {signing ? 'Signing…' : 'Mark as Signed'}
                    </button>
                  )}
                </div>
                {signError && <p className="text-xs text-red-600">{signError}</p>}
              </>
            )}
          </div>
        )}

        <p className="break-all font-mono text-[10px] text-gray-400">Ref: {releaseFormRequestId}</p>

        {cancelError && (
          <p className="w-full rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
            {cancelError}
          </p>
        )}

        <button
          onClick={onReset}
          className="w-full rounded-xl bg-purple-700 py-3 text-sm font-bold text-white hover:bg-purple-800"
        >
          Start New Sale
        </button>
        <button
          onClick={handleCancelRequest}
          disabled={cancelling}
          className="text-xs font-medium text-gray-400 hover:text-red-500 disabled:opacity-50"
        >
          {cancelling ? 'Cancelling…' : 'Cancel this request'}
        </button>
      </div>
    </div>
  )
}

// Scenario 03, Part 3 — shown after a SkuReservation (+ optional
// CustomerAdvance deposit) is created. Deliberately simple — no receipt,
// no COGS/loyalty concepts, since nothing sold yet.
function ReserveSuccessScreen({
  reservationSuccess,
  onReset,
  fmt,
}: {
  reservationSuccess: {
    reservationId: string
    itemName: string
    quantity: number
    customerName: string
    depositAmount: number
  }
  onReset: () => void
  fmt: (n: number) => string
}) {
  return (
    <div className="flex min-h-full items-center justify-center bg-zinc-50 p-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-5 rounded-2xl border border-amber-100 bg-white p-8 text-center shadow-sm">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
          <CheckCircle2 size={28} className="text-amber-600" />
        </div>
        <div>
          <p className="text-xl font-bold text-gray-900">Reservation Created</p>
          <p className="mt-1 text-sm text-gray-500">
            Held for {reservationSuccess.customerName} — no serial required yet.
          </p>
        </div>

        <div className="w-full space-y-2 rounded-xl bg-gray-50 px-5 py-4 text-left">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-medium text-gray-800">
              {reservationSuccess.itemName}
            </span>
            <span className="shrink-0 font-mono text-xs text-gray-500">
              Qty {reservationSuccess.quantity}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2">
            <span className="text-sm font-semibold text-gray-700">Deposit Collected</span>
            <span className="text-lg font-bold text-gray-900">
              {reservationSuccess.depositAmount > 0 ? fmt(reservationSuccess.depositAmount) : '—'}
            </span>
          </div>
        </div>

        <p className="break-all font-mono text-[10px] text-gray-400">
          Ref: {reservationSuccess.reservationId}
        </p>

        <button
          onClick={onReset}
          className="w-full rounded-xl bg-purple-700 py-3 text-sm font-bold text-white hover:bg-purple-800"
        >
          Start New Sale
        </button>
      </div>
    </div>
  )
}

// ─── Catalog Card ─────────────────────────────────────────────────────────────

function CatalogCard({
  item,
  qty,
  onAdd,
  onAddMeasured,
  stockKnown,
}: {
  item: LookupItem
  qty: number
  onAdd: (item: LookupItem) => void
  onAddMeasured?: (item: LookupItem) => void
  /** False while stock hasn't been resolved to a specific branch yet (e.g.
   * multiple open sessions, none picked) — every item's stockQty defaults to
   * 0 in that window, so it must never be read as "genuinely out of stock"
   * until this is true. */
  stockKnown: boolean
}) {
  // Only serial-tracked items are hard-blocked at zero — a serial-tracked
  // sale is impossible with nothing to pick, unlike a bulk/quantity item
  // where allowNegativeStock or a backorder might still apply.
  const isOutOfStock = stockKnown && item.isSerialTracked && (item.stockQty ?? 0) === 0
  const isLowStock =
    stockKnown && item.stockQty !== undefined && item.stockQty > 0 && item.stockQty <= 5

  return (
    <button
      disabled={isOutOfStock}
      onMouseDown={() =>
        isOutOfStock
          ? undefined
          : item.allowDecimal && onAddMeasured
            ? onAddMeasured(item)
            : onAdd(item)
      }
      className={`group relative flex flex-col rounded-xl border p-3 text-left shadow-sm transition-all ${
        isOutOfStock
          ? 'cursor-not-allowed border-gray-100 bg-gray-50 opacity-60'
          : 'border-gray-200 bg-white hover:border-purple-300 hover:shadow-md active:scale-[0.97]'
      }`}
    >
      {qty > 0 && (
        <span className="absolute right-2 top-2 flex h-5 min-w-5 px-1 items-center justify-center rounded-full bg-purple-600 text-[10px] font-bold text-white shadow">
          {Number.isInteger(qty) ? qty : qty.toFixed(1)}
        </span>
      )}
      <p className="line-clamp-2 text-sm font-semibold leading-tight text-gray-900 pr-5">
        {itemDisplayLabel({
          name: item.name,
          brandName: item.brandName,
          categoryName: item.category?.name,
          modelNumber: item.modelNumber,
        })}
      </p>
      {item.sku && <p className="mt-0.5 truncate text-[11px] text-gray-400">{item.sku}</p>}
      <div className="mt-auto pt-2">
        {item.price <= 0 && (
          <p className="text-[10px] font-bold uppercase tracking-wide text-amber-500">No price</p>
        )}
        <div className="flex items-center gap-1.5">
          {item.uomCode && (
            <span className="text-[10px] font-medium text-gray-400 uppercase">
              per {item.uomCode}
            </span>
          )}
          {isOutOfStock ? (
            <p className="text-[10px] font-bold uppercase tracking-wide text-red-500">
              Out of stock
            </p>
          ) : (
            isLowStock && (
              <p className="text-[10px] font-medium text-amber-500">Low stock: {item.stockQty}</p>
            )
          )}
        </div>
      </div>
    </button>
  )
}

// Same behavior/props as CatalogCard — a denser row layout for scanning many
// items by name/SKU at once, rather than scanning by visual tile.
function CatalogListRow({
  item,
  qty,
  onAdd,
  onAddMeasured,
  stockKnown,
}: {
  item: LookupItem
  qty: number
  onAdd: (item: LookupItem) => void
  onAddMeasured?: (item: LookupItem) => void
  stockKnown: boolean
}) {
  const isOutOfStock = stockKnown && item.isSerialTracked && (item.stockQty ?? 0) === 0
  const isLowStock =
    stockKnown && item.stockQty !== undefined && item.stockQty > 0 && item.stockQty <= 5

  return (
    <button
      disabled={isOutOfStock}
      onMouseDown={() =>
        isOutOfStock
          ? undefined
          : item.allowDecimal && onAddMeasured
            ? onAddMeasured(item)
            : onAdd(item)
      }
      className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all ${
        isOutOfStock
          ? 'cursor-not-allowed border-gray-100 bg-gray-50 opacity-60'
          : 'border-gray-200 bg-white hover:border-purple-300 hover:shadow-sm active:scale-[0.99]'
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-gray-900">
          {itemDisplayLabel({
            name: item.name,
            brandName: item.brandName,
            categoryName: item.category?.name,
            modelNumber: item.modelNumber,
          })}
        </p>
        <div className="flex items-center gap-1.5">
          {item.sku && <p className="truncate text-[11px] text-gray-400">{item.sku}</p>}
          {isOutOfStock ? (
            <p className="text-[10px] font-bold uppercase tracking-wide text-red-500">
              Out of stock
            </p>
          ) : (
            isLowStock && (
              <p className="text-[10px] font-medium text-amber-500">Low stock: {item.stockQty}</p>
            )
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {item.price <= 0 && (
          <p className="text-[10px] font-bold uppercase tracking-wide text-amber-500">No price</p>
        )}
        {item.uomCode && (
          <p className="text-[10px] font-medium text-gray-400 uppercase">per {item.uomCode}</p>
        )}
        {qty > 0 && (
          <span className="flex h-5 min-w-5 px-1 items-center justify-center rounded-full bg-purple-600 text-[10px] font-bold text-white shadow">
            {Number.isInteger(qty) ? qty : qty.toFixed(1)}
          </span>
        )}
      </div>
    </button>
  )
}

// ─── New Customer Modal ───────────────────────────────────────────────────────

function NewCustomerModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (customer: PosCustomer) => void
}) {
  const [form, setForm] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    phone: '',
    email: '',
    customerType: 'individual' as CustomerExtraFieldsValues['customerType'],
    companyName: '',
    businessCategory: '',
    employeeNumber: '',
    birthday: '',
    groupId: '',
    taxId: '',
    isTaxExempt: false,
    taxExemptionRef: '',
    address: '',
    barangayCode: '',
    notes: '',
    coMakers: [] as CoMakerFormValues[],
    idType: '',
    idNumber: '',
    idDocumentFileId: '',
    consentGiven: false,
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Same non-blocking, debounced check CRM's "Add Customer" form uses — never
  // prevents submission, just warns so the cashier can double-check before
  // creating a second profile for the same person.
  const [duplicateWarning, setDuplicateWarning] = useState<DuplicateCheckResult | null>(null)
  const [duplicateDismissed, setDuplicateDismissed] = useState(false)
  const duplicateTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [uploadingId, setUploadingId] = useState(false)
  const [idDocumentName, setIdDocumentName] = useState<string | null>(null)

  useEffect(() => {
    const email = form.email.trim()
    const phone = form.phone.trim()
    if (!email && !phone) {
      setDuplicateWarning(null)
      return
    }
    if (duplicateTimer.current) clearTimeout(duplicateTimer.current)
    duplicateTimer.current = setTimeout(async () => {
      const res = await customersApi.checkDuplicate({
        email: email || undefined,
        phone: phone || undefined,
      })
      if (res.success && res.data) {
        setDuplicateWarning(res.data.duplicate ? res.data : null)
        setDuplicateDismissed(false)
      }
    }, 300)
    return () => {
      if (duplicateTimer.current) clearTimeout(duplicateTimer.current)
    }
  }, [form.email, form.phone])

  async function handleIdFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingId(true)
    const formData = new FormData()
    formData.set('file', file)
    const result = await uploadIdDocument(formData)
    setUploadingId(false)

    if (result.success && result.data) {
      setForm((p) => ({ ...p, idDocumentFileId: result.data!.id }))
      setIdDocumentName(result.data.originalName)
    } else {
      setError(result.message ?? 'ID document upload failed')
      e.target.value = ''
    }
  }

  async function handleSubmit() {
    if (!form.firstName.trim()) {
      setError('First name is required.')
      return
    }
    if (!form.phone.trim()) {
      setError('Phone number is required.')
      return
    }
    setError('')
    setSubmitting(true)
    const res = await createWalkInCustomer({
      firstName: form.firstName.trim(),
      middleName: form.middleName.trim() || undefined,
      lastName: form.lastName.trim(),
      phoneNumber: form.phone.trim(),
      email: form.email.trim() || undefined,
      customerType: form.customerType,
      companyName:
        form.customerType === 'business' ? form.companyName.trim() || undefined : undefined,
      businessCategory:
        form.customerType === 'business' && form.businessCategory
          ? (form.businessCategory as 'private' | 'government')
          : undefined,
      employeeNumber:
        form.customerType === 'employee' ? form.employeeNumber.trim() || undefined : undefined,
      birthday: form.birthday ? new Date(form.birthday) : undefined,
      groupId: form.groupId.trim() || undefined,
      taxId: form.taxId.trim() || undefined,
      isTaxExempt: form.isTaxExempt,
      taxExemptionRef: form.isTaxExempt ? form.taxExemptionRef.trim() || undefined : undefined,
      address: form.address.trim() || undefined,
      barangayCode: form.barangayCode || undefined,
      // Fixed, not user-selectable — a walk-in customer always starts active.
      status: 'active',
      note: form.notes.trim() || undefined,
      coMakers: form.coMakers.map((cm) => ({ ...cm, email: cm.email || undefined })),
      idType: form.idType || undefined,
      idNumber: form.idNumber || undefined,
      idDocumentFileId: form.idDocumentFileId || undefined,
      consentGiven: form.consentGiven,
      consentGivenAt: form.consentGiven ? new Date() : undefined,
    })
    setSubmitting(false)
    if (!res.success || !res.data) {
      setError(res.error ?? 'Failed to create customer')
      return
    }
    onCreated(res.data)
    onClose()
  }

  return (
    <Overlay onClose={onClose} width="2xl">
      <h2 className="mb-4 text-lg font-bold text-gray-900">New Customer</h2>
      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      <div className="max-h-[78vh] space-y-3 overflow-y-auto pr-1">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">First Name *</label>
            <input
              autoFocus
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
              value={form.firstName}
              onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Last Name</label>
            <input
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
              value={form.lastName}
              onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Middle Name</label>
            <input
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
              value={form.middleName}
              onChange={(e) => setForm((p) => ({ ...p, middleName: e.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Phone *</label>
            <PhoneInput
              value={form.phone}
              defaultCountry="PH"
              international
              countryCallingCodeEditable={false}
              onChange={(v) => setForm((p) => ({ ...p, phone: v ?? '' }))}
              numberInputProps={{ className: 'phone-input-field' }}
              className="ph-phone-input"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Email</label>
            <input
              type="email"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            />
          </div>
        </div>

        {duplicateWarning?.duplicate && !duplicateDismissed && (
          <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-[13px] text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="flex-1">
              A customer named{' '}
              <span className="font-medium">{duplicateWarning.customer?.name}</span> already has
              this {duplicateWarning.matchedField}. You can still create this profile if it&apos;s a
              different person.
            </div>
            <button
              type="button"
              onClick={() => setDuplicateDismissed(true)}
              className="shrink-0 text-amber-600 hover:text-amber-800"
              aria-label="Dismiss duplicate warning"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <CustomerExtraFields
          values={form}
          onChange={(patch) => setForm((p) => ({ ...p, ...patch }))}
        />

        <div>
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold text-gray-600">
              Co-maker (guarantor)
            </label>
            <button
              type="button"
              onClick={() =>
                setForm((p) => ({
                  ...p,
                  coMakers: [
                    ...p.coMakers,
                    { name: '', relationship: '', contactNumber: '', email: '' },
                  ],
                }))
              }
              className="flex items-center gap-1 text-[12px] font-medium text-purple-700 hover:text-purple-800"
            >
              <Plus className="h-3.5 w-3.5" />
              Add co-maker
            </button>
          </div>
          <div className="mt-2 space-y-3">
            {form.coMakers.map((cm, idx) => (
              <div
                key={idx}
                className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] items-end gap-2 rounded-lg border border-gray-200 p-3"
              >
                <div>
                  <label className="block text-[12px] font-medium text-gray-600">Name</label>
                  <input
                    value={cm.name}
                    maxLength={255}
                    placeholder="e.g. Juan Dela Cruz"
                    onChange={(e) => {
                      const next = [...form.coMakers]
                      next[idx] = { ...next[idx], name: e.target.value }
                      setForm((p) => ({ ...p, coMakers: next }))
                    }}
                    className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-600">
                    Relationship
                  </label>
                  <input
                    value={cm.relationship}
                    maxLength={100}
                    placeholder="e.g. Spouse"
                    onChange={(e) => {
                      const next = [...form.coMakers]
                      next[idx] = { ...next[idx], relationship: e.target.value }
                      setForm((p) => ({ ...p, coMakers: next }))
                    }}
                    className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-600">
                    Contact number
                  </label>
                  <input
                    value={cm.contactNumber}
                    maxLength={50}
                    placeholder="e.g. 0917 000 1111"
                    onChange={(e) => {
                      const next = [...form.coMakers]
                      next[idx] = { ...next[idx], contactNumber: e.target.value }
                      setForm((p) => ({ ...p, coMakers: next }))
                    }}
                    className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-600">Email</label>
                  <input
                    value={cm.email ?? ''}
                    maxLength={255}
                    type="email"
                    onChange={(e) => {
                      const next = [...form.coMakers]
                      next[idx] = { ...next[idx], email: e.target.value }
                      setForm((p) => ({ ...p, coMakers: next }))
                    }}
                    className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setForm((p) => ({
                      ...p,
                      coMakers: p.coMakers.filter((_, i) => i !== idx),
                    }))
                  }
                  className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                  aria-label="Remove co-maker"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600">
            ID & Consent <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <div className="mt-2 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-medium text-gray-600">ID Type</label>
              <select
                value={form.idType}
                onChange={(e) => setForm((p) => ({ ...p, idType: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm"
              >
                <option value="">Select ID type</option>
                {ID_TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-medium text-gray-600">ID Number</label>
              <input
                value={form.idNumber}
                maxLength={100}
                onChange={(e) => setForm((p) => ({ ...p, idNumber: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm"
              />
            </div>
          </div>
          <div className="mt-3">
            <label className="block text-[12px] font-medium text-gray-600">ID Document</label>
            <label className="mt-1 flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-500">
              <Paperclip className="h-4 w-4 shrink-0" />
              <span className="truncate">
                {uploadingId ? 'Uploading…' : (idDocumentName ?? 'Attach a scanned ID')}
              </span>
              <input
                type="file"
                className="hidden"
                disabled={uploadingId}
                onChange={handleIdFileChange}
              />
            </label>
          </div>
          <div className="mt-3 flex items-start gap-2">
            <input
              id="pos-new-customer-consent"
              type="checkbox"
              checked={form.consentGiven}
              onChange={(e) => setForm((p) => ({ ...p, consentGiven: e.target.checked }))}
              className="mt-0.5 h-4 w-4 rounded border-gray-300"
            />
            <label htmlFor="pos-new-customer-consent" className="text-[13px] text-gray-700">
              Customer has given consent to store their ID information on file.
            </label>
          </div>
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-3">
        <button
          onClick={onClose}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting || !form.firstName.trim() || !form.phone.trim()}
          className="rounded-lg bg-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-purple-800 disabled:opacity-50"
        >
          {submitting ? 'Creating…' : 'Create Customer'}
        </button>
      </div>
    </Overlay>
  )
}

// ─── Overlay ──────────────────────────────────────────────────────────────────

function Overlay({
  children,
  onClose,
  dismissible = true,
  width = 'md',
  dim = 'default',
}: {
  children: React.ReactNode
  onClose: () => void
  /** When false, there's no backdrop-click or X close — the modal can only be
   * dismissed by whatever action inside it programmatically closes it. */
  dismissible?: boolean
  /** 'lg'/'xl'/'2xl' give content-heavy modals (e.g. the cross-branch serial
   * picker, which grows to 'xl' while its side panel is open) more room —
   * every other caller is unaffected by leaving this at 'md'. */
  width?: 'md' | 'lg' | 'xl' | '2xl'
  /** 'strong' darkens the backdrop a bit more — for a confirmation stacked on
   * top of another modal (e.g. the serial picker), so it reads as more
   * focused/on top rather than blending into the modal beneath it. */
  dim?: 'default' | 'strong'
}) {
  const maxWidthClass =
    width === '2xl'
      ? 'max-w-4xl'
      : width === 'xl'
        ? 'max-w-2xl'
        : width === 'lg'
          ? 'max-w-lg'
          : 'max-w-md'
  return (
    <>
      <div
        className={`fixed inset-0 z-40 ${dim === 'strong' ? 'bg-black/60' : 'bg-black/30'}`}
        onClick={dismissible ? onClose : undefined}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className={`relative w-full ${maxWidthClass} rounded-2xl bg-white p-6 shadow-xl transition-[max-width] duration-150`}
        >
          {dismissible && (
            <button
              onClick={onClose}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-700"
            >
              <X size={18} />
            </button>
          )}
          {children}
        </div>
      </div>
    </>
  )
}
