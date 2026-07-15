'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
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
  Zap,
  User,
  UserPlus,
  PauseCircle,
  XCircle,
  ShieldCheck,
  Loader2,
  ChevronDown,
  ChevronUp,
  KeyRound,
  WifiOff,
  UtensilsCrossed,
  Users,
  Mail,
  Phone,
  Send,
  Clock,
} from 'lucide-react'
import { computePricingTotals } from './_utils/calculations'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { useSessions } from '../_hooks/usePos'
import { usePosBranchContext } from '@/src/stores/pos-branch-context.store'
import { usePosPendingRfdStore } from '@/src/stores/pos-pending-rfd.store'
import { Skeleton } from '@/src/components/ui/Skeleton'
import { getUnitsOfMeasure } from '../../inventory/items/_actions/get-lookup-data'
import { getMenuItems } from '../menu-items/_actions/menu-item-actions'
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
  validateManagerOverride,
  syncTransactions,
  updateSessionDisplay,
  sendReceipt,
  getPaymentMethods,
  getDefaultAccountingTaxRate,
  getEnabledBranchPaymentMethods,
  getReceiptBranding,
  getAvailableSerialNumbers,
  getSellingAgents,
  submitCancellationRequest,
  getCancellationRequestStatus,
  cancelReleaseFormRequest,
  type SerialNumberRecord,
} from '../_actions/pos-actions'
import { isPendingApproval, isRefundPendingApproval } from '@/src/schema/pos'
import type {
  PosPaymentMethod,
  PosInvoiceType,
  PromoValidationResult,
  PosCustomer,
  LoyaltyAccount,
  LoyaltyProgram,
  PosTransaction,
  SyncTransactionItem,
  ScPwdDiscountInput,
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
}

interface CartLine {
  itemId: string
  itemName: string
  sku?: string
  unitPrice: number
  quantity: number
  taxRate?: number | null
  uomCode?: string
  allowDecimal?: boolean
  pricingMode?: 'inclusive' | 'exclusive' | null
  isSerialTracked?: boolean
  serialNumberId?: string
  serialNumberLabel?: string
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
  custom: 'Custom',
}

const REF_METHODS: PosPaymentMethod[] = ['card', 'bank_transfer', 'gift_card', 'gcash', 'maya']

const CASH_DENOMINATIONS = [20, 50, 100, 200, 500, 1000]

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n)

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
  const { branchId: switcherBranchId } = usePosBranchContext()
  const { data: sessionsData, isLoading: sessionsLoading } = useSessions({
    status: 'open',
    ...(switcherBranchId ? { branchId: switcherBranchId } : {}),
  })
  const rawSessions = sessionsData?.data
  const openSessions = useMemo(() => rawSessions ?? [], [rawSessions])

  // Session
  const [sessionId, setSessionId] = useState('')

  // Active accounting tax rate (set via Accounting → Tax toggle)
  const [activeTaxRate, setActiveTaxRate] = useState<{ rate: number; name: string } | null>(null)

  // Catalog
  const [catalogItems, setCatalogItems] = useState<LookupItem[]>([])
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [catalogError, setCatalogError] = useState('')

  // Enabled payment methods for the active branch
  const [enabledPaymentMethods, setEnabledPaymentMethods] = useState<PosPaymentMethod[]>(
    Object.keys(PAYMENT_LABELS) as PosPaymentMethod[]
  )

  // Auth session branchId — Branch Managers are scoped to their assigned branch,
  // which is the same branch they can configure via "My Branch" settings.
  const [authBranchId, setAuthBranchId] = useState<string | null>(null)
  const [isBranchManager, setIsBranchManager] = useState(false)
  useEffect(() => {
    getSessionOrNull().then((s) => {
      if (!s) return
      setIsBranchManager(s.primaryRole === 'Branch Manager')
      setAuthBranchId(s.branchId ?? null)
    })
  }, [])

  const activeBranchId = useMemo(() => {
    // Branch Managers: use their assigned branch (matches "My Branch" settings)
    if (isBranchManager && authBranchId) return authBranchId
    // Everyone else: use the terminal's branch
    const session = openSessions.find((s) => s.id === sessionId)
    return session?.terminal?.branchId ?? (session?.terminal as any)?.branch?.id ?? null
  }, [openSessions, sessionId, isBranchManager, authBranchId])

  // Menu items catalog (loaded separately — bundle items are excluded from pos/catalog)
  const [menuItems, setMenuItems] = useState<LookupItem[]>([])
  const [menuItemsLoading, setMenuItemsLoading] = useState(false)
  const [menuItemsLoaded, setMenuItemsLoaded] = useState(false)

  // Cart
  const [cart, setCart] = useState<CartLine[]>([])

  // Item search + catalog mode toggle
  const [searchQuery, setSearchQuery] = useState('')
  const [catalogMode, setCatalogMode] = useState<'items' | 'menu'>('items')

  // Selling agent — CRM-owned agent list, not system User accounts
  const [sellingAgent, setSellingAgent] = useState<{ id: string; name: string } | null>(null)
  const [sellingAgentSearch, setSellingAgentSearch] = useState('')
  const [sellingAgents, setSellingAgents] = useState<
    { id: string; name: string; phone?: string | null; email?: string | null }[]
  >([])
  const [sellingAgentOpen, setSellingAgentOpen] = useState(false)

  // Serial number picker
  const [serialPickerTarget, setSerialPickerTarget] = useState<CartLine | null>(null)
  const [serialNumbers, setSerialNumbers] = useState<SerialNumberRecord[]>([])
  const [serialLoading, setSerialLoading] = useState(false)

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

  // Payment
  const [payments, setPayments] = useState<PaymentRow[]>([])
  // Configured payment methods from API — falls back to hardcoded list if not loaded
  const [configuredMethods, setConfiguredMethods] = useState<
    import('@/src/schema/pos').PaymentMethodConfig[]
  >([])

  // Invoice type: 'cash' (pay now at POS) | 'charge' (create AR invoice, pay later)
  const [invoiceType, setInvoiceType] = useState<PosInvoiceType>('cash')
  const [chargeDueDays, setChargeDueDays] = useState(30)

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

  // SC/PWD discount
  const [scPwdData, setScPwdData] = useState<ScPwdDiscountInput | null>(null)
  const [showScPwdModal, setShowScPwdModal] = useState(false)
  const [scPwdForm, setScPwdForm] = useState<{
    type: 'SC' | 'PWD'
    idNumber: string
    name: string
    signatureCapture: string
  }>({ type: 'SC', idNumber: '', name: '', signatureCapture: '' })
  const [scPwdFormError, setScPwdFormError] = useState('')

  // Manager override
  const [managerOverrideApproved, setManagerOverrideApproved] = useState(false)
  const [overrideManagerName, setOverrideManagerName] = useState('')
  const [showOverrideDialog, setShowOverrideDialog] = useState(false)
  const [overrideManagerId, setOverrideManagerId] = useState('')
  const [overridePin, setOverridePin] = useState('')
  const [overrideError, setOverrideError] = useState('')
  const [overridePending, setOverridePending] = useState(false)

  // Submit
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [taxConfigError, setTaxConfigError] = useState(false)
  const [success, setSuccess] = useState<{
    transactionId: string
    transactionNumber: string
    change: number
    journalEntryId?: string | null
    arInvoiceId?: string | null
    loyaltyEarned: boolean
    offlineBuffered?: boolean
    invoiceType?: PosInvoiceType
  } | null>(null)

  // Pending manager approval (serial-tracked sale awaiting Release Form review)
  const [pendingApproval, setPendingApproval] = useState<{
    releaseFormRequestId: string
    totalAmount: number
    serialLines: { itemName: string; serialNumberLabel?: string }[]
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

  // Auto-select the only open session; clear stale sessionId when session is no longer open
  useEffect(() => {
    if (!sessionsData) return
    const isStale = sessionId && !openSessions.some((s) => s.id === sessionId)
    if (isStale) {
      setSessionId(openSessions.length === 1 ? openSessions[0].id : '')
    } else if (openSessions.length === 1 && !sessionId) {
      setSessionId(openSessions[0].id)
    }
  }, [openSessions, sessionsData, sessionId])

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
          if (item.uomCode || item.allowDecimal) return item
          const uom = item.baseUnitId ? uomMap[item.baseUnitId] : undefined
          if (!uom) return item
          const uomCode = uom.code
          const allowDecimal =
            uom.allowDecimal === true ||
            (uom.allowDecimal !== false && DECIMAL_CODES.has(uomCode.toLowerCase()))
          return { ...item, uomCode, allowDecimal }
        })

        setCatalogItems(enriched)
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

  // Load CRM sales agent list for the selling-agent typeahead
  useEffect(() => {
    getSellingAgents().then((res) => {
      if (res.success && Array.isArray(res.data)) setSellingAgents(res.data)
    })
  }, [])

  // Fetch serial numbers when picker target changes
  useEffect(() => {
    if (!serialPickerTarget) return
    setSerialLoading(true)
    setSerialNumbers([])
    getAvailableSerialNumbers(serialPickerTarget.itemId).then((res) => {
      if (res.success && Array.isArray(res.data)) setSerialNumbers(res.data)
      setSerialLoading(false)
    })
  }, [serialPickerTarget?.itemId])

  // Fetch the active default accounting tax rate — controls global POS tax
  useEffect(() => {
    getDefaultAccountingTaxRate().then(setActiveTaxRate)
  }, [sessionId])

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
    () => Object.fromEntries(cart.map((l) => [l.itemId, l.quantity])),
    [cart]
  )

  // Lazy-load menu items the first time the menu tab is opened
  useEffect(() => {
    if (catalogMode !== 'menu' || menuItemsLoaded) return
    setMenuItemsLoading(true)
    getMenuItems().then((data) => {
      const mapped = data.map((item) => ({
        id: item.id,
        name: item.name,
        sku: item.sku ?? undefined,
        price: item.sellingPrice ?? 0,
        isBundle: true,
        uomCode: undefined,
      }))
      setMenuItems(mapped)
      setMenuItemsLoaded(true)
      setMenuItemsLoading(false)
    })
  }, [catalogMode, menuItemsLoaded])

  const displayItems = useMemo(() => {
    const source =
      catalogMode === 'menu' ? menuItems : catalogItems.filter((item) => !item.isBundle)
    const q = searchQuery.trim().toLowerCase()
    if (!q) return source
    return source.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.sku?.toLowerCase().includes(q) ||
        item.barcode?.toLowerCase().includes(q)
    )
  }, [catalogItems, menuItems, searchQuery, catalogMode])

  const rawSubtotal = cart.reduce((s, l) => s + lineTotal(l), 0)

  const { vatExclSubtotalForBackend, effectiveTaxRate, taxTotal } = computePricingTotals({
    cart,
    rawSubtotal,
    inclusivePricing,
    activeTaxRate,
    isTaxExempt,
  })

  // promoDiscount is cleared when SC/PWD is active (cannot stack)
  const promoDiscount = promoResult?.valid && !scPwdData ? (promoResult.discountAmount ?? 0) : 0

  // Display subtotal: inclusive mode shows tag prices as-is; exclusive adds tax
  const subtotal = inclusivePricing ? rawSubtotal : rawSubtotal + taxTotal

  // SC/PWD: 20% on VAT-exclusive base per BIR rules (exact reconciliation done server-side)
  const scPwdEstimatedDiscount = scPwdData
    ? Math.round(vatExclSubtotalForBackend * 0.2 * 100) / 100
    : 0

  const totalAmount = Math.max(
    0,
    Math.round((subtotal - promoDiscount - scPwdEstimatedDiscount) * 100) / 100
  )
  const totalPaid = Math.round(payments.reduce((s, p) => s + (p.amount || 0), 0) * 100) / 100
  const balance = Math.max(0, Math.round((totalAmount - totalPaid) * 100) / 100)
  const change = totalPaid > totalAmount ? Math.round((totalPaid - totalAmount) * 100) / 100 : 0

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

  // ─── Push cart to customer display ────────────────────────────────────────

  const displayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!sessionId || success) return
    if (displayTimerRef.current) clearTimeout(displayTimerRef.current)
    displayTimerRef.current = setTimeout(() => {
      updateSessionDisplay(sessionId, {
        status: cart.length > 0 ? 'active' : 'idle',
        lines: cart.map((l) => ({
          itemName: l.itemName,
          quantity: l.quantity,
          unitPrice:
            effectiveTaxRate != null ? l.unitPrice * (1 + effectiveTaxRate / 100) : l.unitPrice,
          lineTotal:
            effectiveTaxRate != null ? lineTotal(l) * (1 + effectiveTaxRate / 100) : lineTotal(l),
        })),
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
    setCart((prev) => {
      const existing = prev.find((l) => l.itemId === item.id)
      if (existing) {
        if (existing.isSerialTracked) return prev
        return prev.map((l) =>
          l.itemId === item.id ? { ...l, quantity: parseFloat((l.quantity + qty).toFixed(3)) } : l
        )
      }
      return [
        ...prev,
        {
          itemId: item.id,
          itemName: item.name,
          sku: item.sku,
          unitPrice: item.price,
          quantity: item.isSerialTracked ? 1 : qty,
          taxRate: item.taxRate ?? null,
          uomCode: item.uomCode,
          allowDecimal: item.allowDecimal ?? false,
          pricingMode: item.pricingMode ?? null,
          isSerialTracked: item.isSerialTracked ?? false,
        },
      ]
    })
    if (item.isSerialTracked) {
      setSerialPickerTarget({
        itemId: item.id,
        itemName: item.name,
        unitPrice: item.price,
        quantity: 1,
        isSerialTracked: true,
      })
    }
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
    if (!overrideManagerId.trim()) {
      setOverrideError("Enter the manager's User ID.")
      return
    }
    if (!overridePin.trim()) {
      setOverrideError("Enter the manager's PIN.")
      return
    }
    setOverridePending(true)
    const res = await validateManagerOverride(overrideManagerId.trim(), overridePin.trim())
    setOverridePending(false)
    if (!res.success || !res.data) {
      setOverrideError(res.error ?? 'Override failed')
      return
    }
    setManagerOverrideApproved(true)
    setOverrideManagerName(res.data.managerName ?? 'Manager')
    setShowOverrideDialog(false)
    setOverrideManagerId('')
    setOverridePin('')
    setOverrideError('')
  }

  // ─── Payment actions ───────────────────────────────────────────────────────

  function addPaymentRow() {
    if (configuredMethods.length > 0) {
      const eligible = configuredMethods.filter((m) => {
        if (isOffline) return m.key === 'cash'
        return m.key === null
          ? enabledPaymentMethods.includes('custom')
          : enabledPaymentMethods.includes(m.key as PosPaymentMethod)
      })
      const first = eligible[0]
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
    const defaultMethod = isOffline ? 'cash' : (enabledPaymentMethods[0] ?? 'cash')
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
    if (isTaxExempt && !taxExemptionRef.trim()) {
      setError('Enter a certificate or exemption reference for tax-exempt sales.')
      return
    }

    if (invoiceType === 'charge') {
      if (!selectedCustomer) {
        setError('A customer must be selected to issue a charge invoice.')
        return
      }
      if (isOffline) {
        setError('Charge invoices require an active network connection.')
        return
      }
    } else {
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
      const missingRef = payments.find(
        (p) => REF_METHODS.includes(p.method) && p.amount > 0 && !p.referenceNumber.trim()
      )
      if (missingRef) {
        setError(`Reference number is required for ${PAYMENT_LABELS[missingRef.method]}.`)
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
        subtotal: rawSubtotal,
        totalAmount,
        isTaxExempt: isTaxExempt || !!scPwdData,
        taxExemptionRef: isTaxExempt ? taxExemptionRef : undefined,
        offlinePaymentMethods: payments.filter((p) => p.amount > 0).map((p) => p.method),
        scPwdDiscount: scPwdData ?? undefined,
        lines: cart.map((l) => ({
          itemId: l.itemId,
          itemName: l.itemName,
          sku: l.sku,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          discountAmount: 0,
          taxAmount: effectiveTaxRate != null ? lineTotal(l) * (effectiveTaxRate / 100) : 0,
          pricingMode: l.pricingMode ?? undefined,
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
          invoiceType,
          chargeDueDays: invoiceType === 'charge' ? chargeDueDays : undefined,
          customerId: selectedCustomer?.id,
          promoCodeId: promoResult?.promoCode?.id,
          discountAmount: promoDiscount,
          taxAmount: taxTotal,
          subtotal: rawSubtotal,
          totalAmount,
          isTaxExempt: isTaxExempt || !!scPwdData,
          taxExemptionRef: isTaxExempt ? taxExemptionRef : undefined,
          managerOverride: managerOverrideApproved || undefined,
          managerUserId: managerOverrideApproved ? overrideManagerId : undefined,
          allowNegativeStock: allowNegativeStock || undefined,
          scPwdDiscount: scPwdData ?? undefined,
          sellingAgentId: sellingAgent?.id,
          lines: cart.map((l) => ({
            itemId: l.itemId,
            itemName: l.itemName,
            sku: l.sku,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            discountAmount: 0,
            taxAmount: effectiveTaxRate != null ? lineTotal(l) * (effectiveTaxRate / 100) : 0,
            pricingMode: l.pricingMode ?? undefined,
            serialNumberId: l.serialNumberId,
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
                  l.itemId === stale.itemId
                    ? { ...l, serialNumberId: undefined, serialNumberLabel: undefined }
                    : l
                )
              )
              setError(
                `${stale.itemName}'s serial number is no longer available — please select another.`
              )
              setSubmitting(false)
              setSerialPickerTarget({
                itemId: stale.itemId,
                itemName: stale.itemName,
                unitPrice: stale.unitPrice,
                quantity: stale.quantity,
                isSerialTracked: true,
              })
              return
            }
          }

          const isTaxErr =
            errMsg.toLowerCase().includes('no tax rate configured') ||
            errMsg.toLowerCase().includes('tax rate')
          setTaxConfigError(isTaxErr)
          setError(errMsg)
          setSubmitting(false)
          return
        }

        // Serial-tracked line in the cart — backend deferred to manager approval
        // instead of completing the sale. Show the pending screen and bail out
        // before any payment/loyalty steps run (there is no transaction yet).
        if (isPendingApproval(txRes.data)) {
          const { releaseFormRequestId, sessionId: rfdSessionId } = txRes.data
          const serialLines = cart
            .filter((l) => l.isSerialTracked)
            .map((l) => ({ itemName: l.itemName, serialNumberLabel: l.serialNumberLabel }))
          const itemNameSummary =
            serialLines.length === 1
              ? serialLines[0].itemName
              : `${serialLines.length} serial-tracked items`

          usePosPendingRfdStore.getState().add({
            releaseFormRequestId,
            itemName: itemNameSummary,
            totalAmount,
            submittedAt: new Date().toISOString(),
            sessionId: rfdSessionId,
          })

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
          setPendingApproval({ releaseFormRequestId, totalAmount, serialLines })
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

        setTaxConfigError(false)
        txId = txRes.data.id
        txData = txRes.data
      }

      if (invoiceType === 'cash') {
        let remaining = totalAmount
        for (const p of payments.filter((p) => p.amount > 0)) {
          const actualAmount = parseFloat(Math.min(p.amount, remaining).toFixed(2))
          if (actualAmount <= 0) break
          const payRes = await addPayment(txId, {
            paymentMethod: p.method,
            amount: actualAmount,
            referenceNumber: p.referenceNumber || undefined,
            paymentMethodConfigId: p.configId,
          })
          if (!payRes.success) {
            const isRefFail =
              payRes.error?.includes('REFERENCE_VALIDATION_FAILED') ||
              payRes.error?.toLowerCase().includes('reference validation')
            const label = p.refFieldLabel ?? PAYMENT_LABELS[p.method] ?? 'Reference'
            setError(
              isRefFail
                ? `Invalid ${label} format — please check the value and try again.`
                : `Transaction created but payment failed: ${payRes.error}`
            )
            setSubmitting(false)
            return
          }
          remaining = parseFloat((remaining - actualAmount).toFixed(2))
          if (remaining <= 0) break
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
          orderTotal: totalAmount,
          posTransactionId: txId,
        })
        if (!redeemRes.success) {
          setError(`Payment recorded but loyalty redemption failed: ${redeemRes.error}`)
          setSubmitting(false)
          return
        }
      }

      // Earn loyalty points — silent fail
      let loyaltyEarned = false
      if (loyaltyAccount) {
        try {
          const pointsEarned = Math.floor(totalAmount * (loyaltyProgram?.pointsPerUnit ?? 1))
          const earnRes = await earnPoints(loyaltyAccount.id, {
            points: pointsEarned,
            transactionAmount: totalAmount,
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
        loyaltyEarned,
        invoiceType,
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
    setTaxConfigError(false)
    setSuccess(null)
    setPendingApproval(null)
    setIsTaxExempt(false)
    setTaxExemptionRef('')
    setSearchQuery('')
    setManagerOverrideApproved(false)
    setOverrideManagerName('')
    setScPwdData(null)
    setFromTab(null)
    setInvoiceType('cash')
    setChargeDueDays(30)
    localStorage.removeItem(POS_FROM_TAB_KEY)
    setCancellationReqId(null)
    if (cancellationPollRef.current) {
      clearInterval(cancellationPollRef.current)
      cancellationPollRef.current = null
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
        totalAmount={totalAmount}
        selectedCustomer={selectedCustomer}
        onReset={resetSale}
        fmt={fmt}
        customerDisplayName={customerDisplayName}
        cart={cart}
        payments={payments}
        promoDiscount={promoDiscount}
        effectiveTaxRate={effectiveTaxRate}
      />
    )
  }

  if (pendingApproval) {
    return (
      <PendingApprovalScreen
        releaseFormRequestId={pendingApproval.releaseFormRequestId}
        totalAmount={pendingApproval.totalAmount}
        serialLines={pendingApproval.serialLines}
        onReset={resetSale}
        fmt={fmt}
      />
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
        <div className="flex items-center gap-3 border-b border-amber-200 bg-amber-50 px-5 py-3">
          <ShieldCheck size={14} className="shrink-0 text-amber-500" />
          <p className="text-sm font-medium text-amber-700">
            This sale includes a serialized item — it will need Business Owner or Branch Manager
            approval before the invoice is created.
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
            <div className="flex rounded-lg border border-gray-200 bg-gray-100 p-0.5 text-xs font-semibold">
              <button
                onClick={() => {
                  setCatalogMode('items')
                  setSearchQuery('')
                }}
                className={`flex-1 rounded-md py-1.5 transition-colors ${catalogMode === 'items' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Items
              </button>
              <button
                onClick={() => {
                  setCatalogMode('menu')
                  setSearchQuery('')
                }}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 transition-colors ${catalogMode === 'menu' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <UtensilsCrossed size={11} /> Menu Items
              </button>
            </div>

            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                autoFocus
                className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-4 text-sm outline-none focus:border-purple-400 focus:bg-white focus:ring-2 focus:ring-purple-100"
                placeholder={
                  catalogMode === 'menu' ? 'Search menu items…' : 'Search by name or SKU…'
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            {catalogItems.length > 0 && (
              <p className="text-[10px] text-gray-400">
                {displayItems.length} {catalogMode === 'menu' ? 'menu item' : 'item'}
                {displayItems.length !== 1 ? 's' : ''}
                {searchQuery && ` matching "${searchQuery}"`}
              </p>
            )}
          </div>

          {/* Catalog grid */}
          <div className="flex-1 overflow-y-auto bg-gray-50/60 p-3">
            {catalogLoading || menuItemsLoading ? (
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
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-2">
                {displayItems.map((item) => (
                  <CatalogCard
                    key={item.id}
                    item={item}
                    qty={cartQtyMap[item.id] ?? 0}
                    onAdd={!!cancellationReqId ? () => {} : addToCart}
                    onAddMeasured={!!cancellationReqId ? () => {} : setMeasuredItem}
                    effectiveTaxRate={effectiveTaxRate}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Cart — compact section at the bottom */}
          {cart.length > 0 && (
            <div className="max-h-64 shrink-0 overflow-y-auto border-t border-gray-200 bg-white">
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white/95 px-4 py-2 backdrop-blur-sm">
                <div className="flex items-center gap-2">
                  <ShoppingCart size={12} className="text-purple-500" />
                  <span className="text-xs font-semibold text-gray-700">
                    Cart · {cart.length} item{cart.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <span className="text-xs font-bold text-gray-900">{fmt(subtotal)}</span>
              </div>
              <table className="min-w-full text-sm">
                <tbody className="divide-y divide-gray-50">
                  {cart.map((line) => (
                    <tr key={line.itemId} className="group hover:bg-gray-50">
                      <td className="px-4 py-2">
                        <p className="text-xs font-medium text-gray-900">{line.itemName}</p>
                        {line.sku && <p className="text-[10px] text-gray-400">{line.sku}</p>}
                        {line.isSerialTracked && (
                          <button
                            onClick={() => setSerialPickerTarget(line)}
                            className={`mt-0.5 text-[10px] font-medium underline-offset-2 hover:underline ${line.serialNumberId ? 'text-green-600' : 'text-amber-500'}`}
                          >
                            {line.serialNumberId
                              ? `SN: ${line.serialNumberLabel}`
                              : '⚠ Select serial'}
                          </button>
                        )}
                        {effectiveTaxRate != null ? (
                          <span className="text-[9px] font-semibold text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded">
                            {activeTaxRate?.name ?? `VAT ${effectiveTaxRate}%`}
                          </span>
                        ) : (
                          <span className="text-[9px] font-semibold text-gray-400 bg-gray-100 px-1 py-0.5 rounded">
                            No Tax
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() =>
                              line.allowDecimal
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
                              {line.quantity}
                            </span>
                          )}
                          <button
                            onClick={() =>
                              line.allowDecimal
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
                        {fmt(
                          effectiveTaxRate != null
                            ? lineTotal(line) * (1 + effectiveTaxRate / 100)
                            : lineTotal(line)
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
                  ))}
                </tbody>
              </table>
            </div>
          )}

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
          className={`flex-col overflow-y-auto bg-white md:flex-shrink-0 md:w-80 lg:w-[360px] ${mobilePanel === 'checkout' ? 'flex flex-1' : 'hidden md:flex'}`}
        >
          {/* Customer */}
          <div className="border-b border-gray-100 p-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
              Customer
            </p>

            {selectedCustomer ? (
              <div>
                <div className="flex items-center justify-between rounded-lg bg-purple-50 px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-purple-100">
                      <User size={13} className="text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {customerDisplayName(selectedCustomer)}
                      </p>
                      <div className="flex items-center gap-2">
                        {selectedCustomer.phone && (
                          <p className="text-xs text-gray-500">{selectedCustomer.phone}</p>
                        )}
                        {loyaltyAccount && (
                          <p className="text-[10px] font-medium text-purple-500">
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
                        className="flex items-center gap-0.5 text-[10px] font-medium text-purple-400 hover:text-purple-700"
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
                  <div className="mt-1 divide-y divide-gray-100 rounded-lg border border-gray-100 bg-gray-50">
                    {customerHistory.map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between px-3 py-1.5 text-xs"
                      >
                        <span className="font-mono text-gray-500">{tx.transactionNumber}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400">
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
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-8 pr-7 text-xs outline-none focus:border-purple-400 focus:bg-white focus:ring-2 focus:ring-purple-100"
                    placeholder="Search by name or phone…"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    onBlur={() => setTimeout(() => setCustomerSearchOpen(false), 150)}
                    onFocus={() => customerResults.length > 0 && setCustomerSearchOpen(true)}
                  />
                  {searchingCustomers && (
                    <Loader2
                      size={11}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-gray-400"
                    />
                  )}
                </div>

                {customerSearchOpen && (
                  <div className="mt-1 max-h-36 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
                    {customerResults.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-gray-400">No customers found</p>
                    ) : (
                      customerResults.map((c) => (
                        <button
                          key={c.id}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-purple-50"
                          onMouseDown={() => selectCustomer(c)}
                        >
                          <User size={11} className="shrink-0 text-gray-400" />
                          <div>
                            <p className="font-medium text-gray-900">{customerDisplayName(c)}</p>
                            {c.phone && <p className="text-[10px] text-gray-400">{c.phone}</p>}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}

                <button
                  onClick={() => setShowNewCustomerModal(true)}
                  className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-gray-200 py-2 text-xs text-gray-400 transition-colors hover:border-purple-300 hover:text-purple-500"
                >
                  <UserPlus size={12} /> New Customer
                </button>
              </>
            )}
          </div>

          {/* Selling Agent */}
          <div className="border-b border-gray-100 p-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
              Selling Agent{' '}
              <span className="font-normal normal-case tracking-normal text-gray-300">
                — optional
              </span>
            </p>
            {sellingAgent ? (
              <div className="flex items-center justify-between rounded-lg bg-purple-50 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-purple-100">
                    <User size={13} className="text-purple-600" />
                  </div>
                  <p className="text-sm font-semibold text-gray-900">{sellingAgent.name}</p>
                </div>
                <button
                  onClick={() => {
                    setSellingAgent(null)
                    setSellingAgentSearch('')
                  }}
                  className="text-purple-300 hover:text-purple-600"
                >
                  <X size={13} />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search
                  size={12}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-8 pr-3 text-xs outline-none focus:border-purple-400 focus:bg-white focus:ring-2 focus:ring-purple-100"
                  placeholder="Search agents…"
                  value={sellingAgentSearch}
                  onChange={(e) => {
                    setSellingAgentSearch(e.target.value)
                    setSellingAgentOpen(true)
                  }}
                  onBlur={() => setTimeout(() => setSellingAgentOpen(false), 150)}
                  onFocus={() => sellingAgentSearch && setSellingAgentOpen(true)}
                />
                {sellingAgentOpen && sellingAgentSearch && (
                  <div className="absolute z-10 mt-1 max-h-36 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
                    {(() => {
                      const filtered = sellingAgents.filter(
                        (a) =>
                          a.name?.toLowerCase()?.includes(sellingAgentSearch.toLowerCase()) ||
                          a.phone?.toLowerCase()?.includes(sellingAgentSearch.toLowerCase()) ||
                          a.email?.toLowerCase()?.includes(sellingAgentSearch.toLowerCase())
                      )
                      return filtered.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-gray-400">No agents found</p>
                      ) : (
                        filtered.slice(0, 8).map((a) => (
                          <button
                            key={a.id}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-purple-50"
                            onMouseDown={() => {
                              setSellingAgent({ id: a.id, name: a.name })
                              setSellingAgentSearch('')
                              setSellingAgentOpen(false)
                            }}
                          >
                            <User size={11} className="shrink-0 text-gray-400" />
                            <div>
                              <p className="font-medium text-gray-900">{a.name}</p>
                              <p className="text-[10px] text-gray-400">
                                {a.phone || a.email || ''}
                              </p>
                            </div>
                          </button>
                        ))
                      )
                    })()}
                  </div>
                )}
              </div>
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
          <div className="border-b border-gray-100 p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
              Order Summary
            </p>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-gray-500">
                <span>
                  Subtotal ({cart.length} item{cart.length !== 1 ? 's' : ''})
                </span>
                <span>{fmt(subtotal)}</span>
              </div>
              {promoDiscount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span>−{fmt(promoDiscount)}</span>
                </div>
              )}
              {scPwdEstimatedDiscount > 0 && (
                <div className="flex justify-between text-blue-600 text-xs">
                  <span>{scPwdData?.type === 'PWD' ? 'PWD' : 'SC'} Discount (20%)*</span>
                  <span>−{fmt(scPwdEstimatedDiscount)}</span>
                </div>
              )}
              {taxTotal > 0 && !isTaxExempt && !scPwdData && (
                <>
                  {inclusivePricing && (
                    <div className="flex justify-between text-gray-400 text-xs">
                      <span>VATable Sales (net)</span>
                      <span>{fmt(vatExclSubtotalForBackend)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-gray-400 text-xs">
                    <span>
                      {activeTaxRate?.name ?? 'VAT'} ({activeTaxRate?.rate ?? 0}%)
                    </span>
                    <span>{fmt(taxTotal)}</span>
                  </div>
                </>
              )}
              {isTaxExempt && (
                <div className="flex justify-between text-green-600 text-xs">
                  <span>Tax Exempt</span>
                  <span>—</span>
                </div>
              )}
            </div>
            <div className="mt-3 flex items-baseline justify-between border-t border-gray-100 pt-3">
              <span className="text-sm font-semibold text-gray-700">Total</span>
              <span className="text-2xl font-bold text-gray-900">{fmt(totalAmount)}</span>
            </div>

            {/* Tax exempt toggle */}
            <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
              <div className="flex items-center gap-1.5">
                <ShieldCheck
                  size={13}
                  className={isTaxExempt ? 'text-green-500' : 'text-gray-400'}
                />
                <span className="text-xs text-gray-500">Tax Exempt</span>
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
          <div className="border-b border-gray-100 p-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
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
                    className="flex-1 rounded-lg border border-gray-200 px-3 py-2 font-mono text-sm uppercase tracking-wider outline-none placeholder:normal-case placeholder:tracking-normal focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                    placeholder="Enter promo code"
                    value={promoInput}
                    onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && applyPromo()}
                  />
                  <button
                    onClick={applyPromo}
                    disabled={!promoInput.trim() || validatingPromo || cart.length === 0}
                    className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-40"
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

          {/* SC/PWD Discount */}
          <div className="border-b border-gray-100 p-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
              SC / PWD Discount
            </p>
            {scPwdData ? (
              <div className="flex items-center justify-between rounded-lg bg-blue-50 px-3 py-2">
                <div className="flex items-center gap-2 text-sm text-blue-700">
                  <Users size={12} />
                  <span className="font-semibold">{scPwdData.type}</span>
                  <span className="text-blue-600">{scPwdData.name}</span>
                  <span className="ml-1 text-xs text-blue-400">−{fmt(scPwdEstimatedDiscount)}</span>
                </div>
                <button
                  onClick={() => setScPwdData(null)}
                  className="text-blue-300 hover:text-blue-600"
                >
                  <X size={13} />
                </button>
              </div>
            ) : (
              <button
                disabled={cart.length === 0}
                onClick={() => {
                  setScPwdFormError('')
                  setShowScPwdModal(true)
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 py-3 text-sm text-gray-400 hover:border-blue-300 hover:text-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Users size={14} /> Add SC / PWD Beneficiary
              </button>
            )}
          </div>

          {/* Invoice Type */}
          <div className="border-t border-gray-100 px-5 py-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
              Invoice Type
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setInvoiceType('cash')}
                className={`flex-1 rounded-xl border py-2.5 text-xs font-semibold transition-colors ${
                  invoiceType === 'cash'
                    ? 'border-purple-500 bg-purple-50 text-purple-700'
                    : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                }`}
              >
                Cash Invoice
                <span className="mt-0.5 block text-[10px] font-normal opacity-70">
                  Pay now at checkout
                </span>
              </button>
              <button
                onClick={() => setInvoiceType('charge')}
                className={`flex-1 rounded-xl border py-2.5 text-xs font-semibold transition-colors ${
                  invoiceType === 'charge'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                }`}
              >
                Charge Invoice
                <span className="mt-0.5 block text-[10px] font-normal opacity-70">
                  Bill to customer account
                </span>
              </button>
            </div>
            {invoiceType === 'charge' && (
              <div className="mt-2.5 space-y-2">
                {!selectedCustomer && (
                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    A customer must be selected to issue a charge invoice.
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500 whitespace-nowrap">Due in</label>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={chargeDueDays}
                    onChange={(e) => setChargeDueDays(Math.max(1, parseInt(e.target.value) || 30))}
                    className="w-20 rounded-lg border border-gray-200 px-2 py-1.5 text-center text-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  />
                  <label className="text-xs text-gray-500">days</label>
                </div>
              </div>
            )}
          </div>

          {/* Payment */}
          <div className="flex-1 p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Payment
              </p>
              {invoiceType === 'cash' && (
                <button
                  onClick={addPaymentRow}
                  className="flex items-center gap-1 rounded-lg bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-700 hover:bg-purple-100"
                >
                  <Plus size={11} /> Add
                </button>
              )}
            </div>

            {invoiceType === 'charge' ? (
              <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-5 text-center">
                <Receipt size={20} className="mx-auto mb-2 text-blue-400" />
                <p className="text-xs font-medium text-blue-700">Charge invoice will be created</p>
                <p className="mt-1 text-[11px] text-blue-500">
                  An AR invoice will be posted to the customer&apos;s account. Payment is collected
                  through Accounts Receivable.
                </p>
                {selectedCustomer && (
                  <p className="mt-2 rounded-lg bg-blue-100 px-3 py-1.5 text-[11px] font-medium text-blue-700">
                    {customerDisplayName(selectedCustomer)} · Due in {chargeDueDays} day
                    {chargeDueDays !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            ) : payments.length === 0 ? (
              <button
                onClick={addPaymentRow}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 py-5 text-sm text-gray-400 hover:border-purple-300 hover:text-purple-500"
              >
                <Plus size={14} /> Add payment method
              </button>
            ) : (
              <div className="space-y-2">
                {payments.map((p, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="relative min-w-0 flex-1">
                      <select
                        className="w-full appearance-none cursor-pointer rounded-lg border border-gray-200 bg-white py-2 pl-2 pr-6 text-xs text-gray-800 outline-none transition-colors focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                        value={p.configId ?? p.method}
                        onChange={(e) => {
                          const val = e.target.value
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
                              })
                              return
                            }
                          }
                          updatePayment(i, { method: val as PosPaymentMethod, configId: undefined })
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
                        className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400"
                      />
                    </div>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      className="w-28 rounded-lg border border-gray-200 px-2 py-2 text-right font-mono text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                      placeholder="0.00"
                      value={p.amount === 0 ? '' : p.amount}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value)
                        updatePayment(i, { amount: isNaN(val) ? 0 : val })
                      }}
                    />
                    <button
                      onClick={() => removePaymentRow(i)}
                      className="flex-shrink-0 text-gray-300 hover:text-red-500"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}

                {/* Quick cash denomination buttons */}
                {payments.some((p) => p.method === 'cash') && (
                  <div className="mt-1">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                      Quick Amount
                    </p>
                    <div className="flex flex-wrap gap-1">
                      <button
                        onClick={() => {
                          const idx = payments.findIndex((p) => p.method === 'cash')
                          if (idx >= 0) updatePayment(idx, { amount: totalAmount })
                        }}
                        className="flex items-center gap-0.5 rounded-lg bg-purple-50 px-2 py-1 text-xs font-semibold text-purple-700 transition-colors hover:bg-purple-100"
                      >
                        <Zap size={10} />
                        Exact
                      </button>
                      {CASH_DENOMINATIONS.map((d) => (
                        <button
                          key={d}
                          onClick={() => {
                            const idx = payments.findIndex((p) => p.method === 'cash')
                            if (idx >= 0) updatePayment(idx, { amount: d })
                          }}
                          className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100"
                        >
                          ₱{d}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reference number — required for card / bank / gift card / custom with ref field */}
                {payments.some(
                  (p) => p.amount > 0 && (REF_METHODS.includes(p.method) || p.refFieldLabel)
                ) && (
                  <div className="mt-2 space-y-1.5">
                    {payments.map((p, i) => {
                      const needsRef =
                        p.amount > 0 && (REF_METHODS.includes(p.method) || p.refFieldLabel)
                      const label =
                        p.refFieldLabel ??
                        (PAYMENT_LABELS[p.method]
                          ? `${PAYMENT_LABELS[p.method]} reference`
                          : 'Reference')
                      const isRequired = p.refRequired ?? REF_METHODS.includes(p.method)
                      return needsRef ? (
                        <div key={i}>
                          <input
                            className={`w-full rounded-lg border px-3 py-1.5 text-xs outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 ${isRequired && !p.referenceNumber.trim() ? 'border-amber-300 bg-amber-50 placeholder:text-amber-500' : 'border-gray-200'}`}
                            placeholder={`${label}${isRequired ? ' * required' : ''}`}
                            value={p.referenceNumber}
                            onChange={(e) => updatePayment(i, { referenceNumber: e.target.value })}
                          />
                        </div>
                      ) : null
                    })}
                  </div>
                )}

                {/* Loyalty points balance indicator */}
                {loyaltyPaymentRow && loyaltyPaymentRow.amount > 0 && loyaltyAccount && (
                  <div
                    className={`mt-2 rounded-lg px-3 py-1.5 text-xs ${loyaltyOverBalance ? 'bg-red-50 text-red-600' : 'bg-purple-50 text-purple-600'}`}
                  >
                    {loyaltyOverBalance
                      ? `Insufficient — need ${loyaltyPointsNeeded} pts, have ${loyaltyAccount.currentPoints} pts`
                      : `Redeeming ~${loyaltyPointsNeeded} pts · Balance: ${loyaltyAccount.currentPoints} pts`}
                  </div>
                )}
              </div>
            )}

            {/* Totals */}
            {payments.length > 0 && (
              <div className="mt-4 space-y-1.5 border-t border-gray-100 pt-4 text-sm">
                <div className="flex justify-between text-gray-500">
                  <span>Total Tendered</span>
                  <span className="font-mono font-medium text-gray-700">{fmt(totalPaid)}</span>
                </div>
                {balance > 0.009 && (
                  <div className="flex items-center justify-between rounded-lg bg-red-50 px-3 py-2 font-bold text-red-700">
                    <span>Still Needed</span>
                    <span className="font-mono">{fmt(balance)}</span>
                  </div>
                )}
                {change > 0.009 && (
                  <div className="flex items-center justify-between rounded-lg bg-green-50 px-3 py-2 font-bold text-green-700">
                    <span>Change</span>
                    <span className="font-mono">{fmt(change)}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Confirm */}
          <div className="border-t border-gray-100 p-5">
            {error && (
              <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                <p>{error}</p>
                {taxConfigError && (
                  <a
                    href="/accounting/tax"
                    className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-red-700 underline hover:text-red-900"
                  >
                    Go to Tax Configuration →
                  </a>
                )}
              </div>
            )}
            <button
              onClick={handleConfirm}
              disabled={
                submitting ||
                cart.length === 0 ||
                !sessionId ||
                cart.some((l) => l.isSerialTracked && !l.serialNumberId) ||
                (invoiceType === 'cash' && (balance > 0.009 || loyaltyOverBalance)) ||
                (invoiceType === 'charge' && !selectedCustomer) ||
                (needsManagerOverride && !managerOverrideApproved)
              }
              className={`w-full rounded-xl py-4 text-sm font-bold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.99] ${
                invoiceType === 'charge'
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'bg-purple-700 hover:bg-purple-800'
              }`}
            >
              {submitting
                ? 'Processing…'
                : cart.length === 0
                  ? 'Add items to continue'
                  : cart.some((l) => l.isSerialTracked && !l.serialNumberId)
                    ? 'Select serial numbers to continue'
                    : invoiceType === 'charge' && !selectedCustomer
                      ? 'Select a customer to charge'
                      : invoiceType === 'cash' && balance > 0.009
                        ? `Underpaid by ${fmt(balance)}`
                        : invoiceType === 'cash' && loyaltyOverBalance
                          ? 'Insufficient loyalty points'
                          : needsManagerOverride && !managerOverrideApproved
                            ? 'Manager override required'
                            : cart.some((l) => l.isSerialTracked)
                              ? `Submit for Approval — ${fmt(totalAmount)}`
                              : invoiceType === 'charge'
                                ? `Issue Charge Invoice — ${fmt(totalAmount)}`
                                : `Confirm Sale — ${fmt(totalAmount)}`}
            </button>
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
              <label className="mb-1 block text-xs font-semibold text-gray-600">
                Manager User ID
              </label>
              <input
                autoFocus
                className="input font-mono text-sm"
                placeholder="Paste manager's User ID (UUID)"
                value={overrideManagerId}
                onChange={(e) => setOverrideManagerId(e.target.value)}
              />
              <p className="mt-1 text-[10px] text-gray-400">Found in HR Settings → My Profile</p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">Manager PIN</label>
              <input
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
              disabled={overridePending || !overrideManagerId.trim() || !overridePin.trim()}
              className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
            >
              <ShieldCheck size={14} />
              {overridePending ? 'Verifying…' : 'Approve Override'}
            </button>
          </div>
        </Overlay>
      )}

      {/* SC/PWD Discount Dialog */}
      {showScPwdModal && (
        <Overlay onClose={() => setShowScPwdModal(false)}>
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
              <Users size={18} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">SC / PWD Discount</h2>
              <p className="text-xs text-gray-500">20% on VAT-exclusive base per BIR rules</p>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">
                Beneficiary Type
              </label>
              <div className="flex gap-2">
                {(['SC', 'PWD'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setScPwdForm((f) => ({ ...f, type: t }))}
                    className={`flex-1 rounded-lg border py-2 text-sm font-semibold transition-colors ${scPwdForm.type === t ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                  >
                    {t === 'SC' ? 'Senior Citizen' : 'PWD'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">ID Number</label>
              <input
                autoFocus
                className="input"
                placeholder="OSCA / PWD ID number"
                value={scPwdForm.idNumber}
                onChange={(e) => setScPwdForm((f) => ({ ...f, idNumber: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">
                Beneficiary Name
              </label>
              <input
                className="input"
                placeholder="Full name as shown on ID"
                value={scPwdForm.name}
                onChange={(e) => setScPwdForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">
                Signature / Acknowledgement
              </label>
              <input
                className="input"
                placeholder="Type name to acknowledge"
                value={scPwdForm.signatureCapture}
                onChange={(e) => setScPwdForm((f) => ({ ...f, signatureCapture: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.form?.requestSubmit?.()
                }}
              />
              <p className="mt-1 text-[10px] text-gray-400">
                Required for BIR record — beneficiary types their name
              </p>
            </div>
          </div>
          {scPwdFormError && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {scPwdFormError}
            </p>
          )}
          <div className="mt-5 flex justify-end gap-3">
            <button
              onClick={() => setShowScPwdModal(false)}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (!scPwdForm.idNumber.trim()) {
                  setScPwdFormError('ID number is required.')
                  return
                }
                if (!scPwdForm.name.trim()) {
                  setScPwdFormError('Beneficiary name is required.')
                  return
                }
                if (!scPwdForm.signatureCapture.trim()) {
                  setScPwdFormError('Signature acknowledgement is required.')
                  return
                }
                setScPwdData({
                  type: scPwdForm.type,
                  idNumber: scPwdForm.idNumber.trim(),
                  name: scPwdForm.name.trim(),
                  signatureCapture: scPwdForm.signatureCapture.trim(),
                })
                setShowScPwdModal(false)
              }}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <ShieldCheck size={14} /> Apply Discount
            </button>
          </div>
        </Overlay>
      )}

      {/* Serial Number Picker */}
      {serialPickerTarget && (
        <Overlay onClose={() => setSerialPickerTarget(null)}>
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100">
              <Tag size={18} className="text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Select Serial Number</h2>
              <p className="text-xs text-gray-500">{serialPickerTarget.itemName}</p>
            </div>
          </div>
          {serialLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-purple-400" />
            </div>
          ) : serialNumbers.length === 0 ? (
            <div className="rounded-lg bg-amber-50 px-4 py-5 text-center text-sm text-amber-700">
              No available serial numbers in stock for this item.
            </div>
          ) : (
            <div className="max-h-64 space-y-1.5 overflow-y-auto">
              {serialNumbers.map((sn) => {
                const isSelected =
                  cart.find((l) => l.itemId === serialPickerTarget.itemId)?.serialNumberId === sn.id
                return (
                  <button
                    key={sn.id}
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-colors ${
                      isSelected
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50'
                    }`}
                    onClick={() => {
                      setCart((prev) =>
                        prev.map((l) =>
                          l.itemId === serialPickerTarget.itemId
                            ? { ...l, serialNumberId: sn.id, serialNumberLabel: sn.serialNumber }
                            : l
                        )
                      )
                      setSerialPickerTarget(null)
                    }}
                  >
                    <span className="font-mono text-sm font-semibold text-gray-900">
                      {sn.serialNumber}
                    </span>
                    {isSelected && <CheckCircle2 size={14} className="text-purple-600" />}
                  </button>
                )
              })}
            </div>
          )}
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => setSerialPickerTarget(null)}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              {cart.find((l) => l.itemId === serialPickerTarget.itemId)?.serialNumberId
                ? 'Done'
                : 'Skip for now'}
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
  effectiveTaxRate,
}: {
  success: {
    transactionId: string
    transactionNumber: string
    change: number
    journalEntryId?: string | null
    arInvoiceId?: string | null
    loyaltyEarned: boolean
    offlineBuffered?: boolean
    invoiceType?: PosInvoiceType
  }
  totalAmount: number
  selectedCustomer: PosCustomer | null
  onReset: () => void
  fmt: (n: number) => string
  customerDisplayName: (c: PosCustomer) => string
  cart: CartLine[]
  payments: PaymentRow[]
  promoDiscount: number
  effectiveTaxRate: number | null
}) {
  const [receiptEmail, setReceiptEmail] = useState(selectedCustomer?.email ?? '')
  const [receiptPhone, setReceiptPhone] = useState(selectedCustomer?.phone ?? '')
  const [receiptSending, setReceiptSending] = useState(false)
  const [receiptSent, setReceiptSent] = useState<string | null>(null)
  const [receiptError, setReceiptError] = useState('')

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

  async function handleSendReceipt() {
    const email = receiptEmail.trim()
    const phone = receiptPhone.trim()
    if (!email && !phone) return
    setReceiptSending(true)
    setReceiptError('')
    setReceiptSent(null)
    const res = await sendReceipt(success.transactionId, {
      email: email || undefined,
      phone: phone || undefined,
    })
    setReceiptSending(false)
    if (!res.success) {
      setReceiptError(res.error ?? 'Failed to send receipt')
      return
    }
    setReceiptSent(email || phone)
  }

  const borderColor = success.offlineBuffered
    ? 'border-amber-200'
    : success.invoiceType === 'charge'
      ? 'border-blue-100'
      : 'border-green-100'

  const iconBg = success.offlineBuffered
    ? 'bg-amber-100'
    : success.invoiceType === 'charge'
      ? 'bg-blue-100'
      : 'bg-green-100'

  return (
    <div className="flex min-h-full items-start justify-center bg-zinc-50 p-6">
      <div className="flex w-full max-w-4xl flex-col items-stretch gap-6 lg:flex-row lg:items-start">
        {/* ── Left: Sale info + actions ─────────────────────────────────── */}
        <div
          className={`flex w-full flex-col gap-4 rounded-2xl border bg-white p-8 shadow-sm lg:w-96 lg:shrink-0 ${borderColor}`}
        >
          {/* Icon + title */}
          <div className="flex flex-col items-center gap-3">
            <div className={`flex h-14 w-14 items-center justify-center rounded-full ${iconBg}`}>
              {success.offlineBuffered ? (
                <WifiOff size={28} className="text-amber-600" />
              ) : success.invoiceType === 'charge' ? (
                <Receipt size={28} className="text-blue-600" />
              ) : (
                <CheckCircle2 size={28} className="text-green-600" />
              )}
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-gray-900">
                {success.offlineBuffered
                  ? 'Sale Buffered (Offline)'
                  : success.invoiceType === 'charge'
                    ? 'Charge Invoice Issued'
                    : 'Sale Complete'}
              </p>
              {success.offlineBuffered ? (
                <p className="mt-1 text-sm text-amber-600">Will sync automatically when online.</p>
              ) : success.invoiceType === 'charge' ? (
                <p className="mt-1 text-sm text-blue-500">
                  AR invoice posted — payment due from customer.
                </p>
              ) : (
                <p className="mt-1 font-mono text-xs text-gray-400">{success.transactionNumber}</p>
              )}
            </div>
          </div>

          {/* Total charged */}
          <div className="rounded-xl bg-gray-50 px-6 py-4 text-center">
            <p className="text-sm text-gray-500">Total Charged</p>
            <p className="text-3xl font-bold text-gray-900">{fmt(totalAmount)}</p>
            {success.change > 0 && (
              <p className="mt-2 text-sm font-medium text-green-600">
                Change: {fmt(success.change)}
              </p>
            )}
          </div>

          {success.journalEntryId && (
            <p className="text-center font-mono text-[10px] text-gray-400">
              JE: {success.journalEntryId}
            </p>
          )}
          {success.loyaltyEarned && selectedCustomer && (
            <p className="text-center text-xs font-medium text-purple-500">
              Points earned for {customerDisplayName(selectedCustomer)}
            </p>
          )}

          {/* Send Receipt */}
          {!success.offlineBuffered && success.transactionId && (
            <div className="space-y-3 rounded-xl border border-gray-100 bg-gray-50 p-4">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
                <Mail size={12} /> Send Receipt
              </p>
              {receiptSent ? (
                <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2">
                  <CheckCircle2 size={14} className="shrink-0 text-green-500" />
                  <p className="text-xs font-medium text-green-700">
                    Receipt sent to {receiptSent}
                  </p>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Mail
                      size={13}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                    <input
                      type="email"
                      placeholder="Email address"
                      value={receiptEmail}
                      onChange={(e) => setReceiptEmail(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-8 pr-3 text-xs outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                    />
                  </div>
                  <div className="relative">
                    <Phone
                      size={13}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                    <input
                      type="tel"
                      placeholder="Phone number (SMS not yet active)"
                      value={receiptPhone}
                      onChange={(e) => setReceiptPhone(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-8 pr-3 text-xs text-gray-500 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                    />
                  </div>
                  {receiptError && (
                    <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                      {receiptError}
                    </p>
                  )}
                  <button
                    onClick={handleSendReceipt}
                    disabled={receiptSending || (!receiptEmail.trim() && !receiptPhone.trim())}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-gray-800 py-2 text-xs font-semibold text-white transition-colors hover:bg-gray-900 disabled:opacity-40"
                  >
                    {receiptSending ? (
                      <>
                        <Loader2 size={11} className="animate-spin" /> Sending…
                      </>
                    ) : (
                      <>
                        <Send size={11} /> Send Receipt
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          )}

          <button
            onClick={onReset}
            className="w-full rounded-xl bg-purple-700 px-8 py-3 text-sm font-bold text-white hover:bg-purple-800"
          >
            New Sale
          </button>
        </div>

        {/* ── Right: Receipt preview ────────────────────────────────────── */}
        <div className="w-full lg:w-72 lg:shrink-0">
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            {/* Branding header */}
            <div className="flex flex-col items-center gap-2 border-b border-gray-100 px-6 py-6">
              {branding?.receiptLogoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={branding.receiptLogoUrl}
                  alt="logo"
                  className="h-12 w-auto max-w-32 object-contain"
                />
              )}
              {headerLines.length > 0 ? (
                <div className="flex flex-col items-center gap-0.5">
                  {headerLines.map((line, i) => (
                    <p key={i} className="text-xs font-medium text-gray-700">
                      {line}
                    </p>
                  ))}
                </div>
              ) : !branding?.receiptLogoUrl ? (
                <p className="text-sm font-semibold text-gray-700">Receipt</p>
              ) : null}
            </div>

            {/* Date + TXN */}
            <div className="space-y-1 border-b border-dashed border-gray-200 px-5 py-3">
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
            </div>

            {/* Items */}
            <div className="space-y-2.5 border-b border-dashed border-gray-200 px-5 py-3">
              {cart.map((line) => {
                const displayUnitPrice =
                  effectiveTaxRate != null
                    ? line.unitPrice * (1 + effectiveTaxRate / 100)
                    : line.unitPrice
                const displayLineTotal =
                  effectiveTaxRate != null
                    ? lineTotal(line) * (1 + effectiveTaxRate / 100)
                    : lineTotal(line)
                return (
                  <div key={line.itemId} className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-medium text-gray-800">
                        {line.itemName}
                      </p>
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

            {/* Totals + payments */}
            <div className="space-y-1 border-b border-gray-100 px-5 py-3">
              {payments
                .filter((p) => p.amount > 0)
                .map((p, i) => (
                  <div key={i} className="flex justify-between text-[11px] text-gray-500">
                    <span>{PAYMENT_LABELS[p.method] ?? p.method}</span>
                    <span>{fmt(p.amount)}</span>
                  </div>
                ))}
              {promoDiscount > 0 && (
                <div className="flex justify-between text-[11px] text-green-600">
                  <span>Discount</span>
                  <span>−{fmt(promoDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-gray-100 pt-1.5 text-sm font-bold text-gray-900">
                <span>Total</span>
                <span>{fmt(totalAmount)}</span>
              </div>
              {success.change > 0 && (
                <div className="flex justify-between text-[11px] font-medium text-green-600">
                  <span>Change</span>
                  <span>{fmt(success.change)}</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 text-center">
              <p className="text-[10px] text-gray-400">Thank you for your purchase!</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Pending Approval Screen ───────────────────────────────────────────────────

function PendingApprovalScreen({
  releaseFormRequestId,
  totalAmount,
  serialLines,
  onReset,
  fmt,
}: {
  releaseFormRequestId: string
  totalAmount: number
  serialLines: { itemName: string; serialNumberLabel?: string }[]
  onReset: () => void
  fmt: (n: number) => string
}) {
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState('')

  async function handleCancelRequest() {
    setCancelling(true)
    setCancelError('')
    const res = await cancelReleaseFormRequest(releaseFormRequestId)
    setCancelling(false)
    if (!res.success) {
      setCancelError(res.error ?? 'Failed to cancel request.')
      return
    }
    usePosPendingRfdStore.getState().remove(releaseFormRequestId)
    onReset()
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

// ─── Catalog Card ─────────────────────────────────────────────────────────────

function CatalogCard({
  item,
  qty,
  onAdd,
  onAddMeasured,
  effectiveTaxRate,
}: {
  item: LookupItem
  qty: number
  onAdd: (item: LookupItem) => void
  onAddMeasured?: (item: LookupItem) => void
  effectiveTaxRate: number | null
}) {
  const displayPrice =
    effectiveTaxRate != null ? item.price * (1 + effectiveTaxRate / 100) : item.price

  return (
    <button
      onMouseDown={() => (item.allowDecimal && onAddMeasured ? onAddMeasured(item) : onAdd(item))}
      className="group relative flex flex-col rounded-xl border border-gray-200 bg-white p-3 text-left shadow-sm transition-all hover:border-purple-300 hover:shadow-md active:scale-[0.97]"
    >
      {qty > 0 && (
        <span className="absolute right-2 top-2 flex h-5 min-w-5 px-1 items-center justify-center rounded-full bg-purple-600 text-[9px] font-bold text-white shadow">
          {Number.isInteger(qty) ? qty : qty.toFixed(1)}
        </span>
      )}
      <p className="line-clamp-2 text-xs font-semibold leading-tight text-gray-900 pr-5">
        {item.name}
      </p>
      {item.sku && <p className="mt-0.5 truncate text-[10px] text-gray-400">{item.sku}</p>}
      <div className="mt-auto pt-2">
        <p className="text-sm font-bold text-purple-700">
          {new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(
            displayPrice
          )}
        </p>
        <div className="flex items-center gap-1.5">
          {item.uomCode && (
            <span className="text-[9px] font-medium text-gray-400 uppercase">
              per {item.uomCode}
            </span>
          )}
          {item.stockQty !== undefined && item.stockQty <= 5 && (
            <p className="text-[9px] font-medium text-amber-500">Low stock: {item.stockQty}</p>
          )}
        </div>
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
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '', email: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    if (!form.firstName.trim()) {
      setError('First name is required.')
      return
    }
    setError('')
    setSubmitting(true)
    const res = await createWalkInCustomer({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim() || undefined,
      phoneNumber: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
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
    <Overlay onClose={onClose}>
      <h2 className="mb-4 text-lg font-bold text-gray-900">New Customer</h2>
      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
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
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-600">Phone</label>
          <input
            type="tel"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
            placeholder="09XX XXX XXXX"
            value={form.phone}
            onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
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
      <div className="mt-5 flex justify-end gap-3">
        <button
          onClick={onClose}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="rounded-lg bg-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-purple-800 disabled:opacity-50"
        >
          {submitting ? 'Creating…' : 'Create Customer'}
        </button>
      </div>
    </Overlay>
  )
}

// ─── Overlay ──────────────────────────────────────────────────────────────────

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-gray-400 hover:text-gray-700"
          >
            <X size={18} />
          </button>
          {children}
        </div>
      </div>
    </>
  )
}
