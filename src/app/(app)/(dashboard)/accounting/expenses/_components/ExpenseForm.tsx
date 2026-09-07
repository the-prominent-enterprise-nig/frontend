'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, Plus, Trash2 } from 'lucide-react'
import {
  Expenses,
  APBillSuppliers,
  APBills,
  AccountMappings,
  BankAccounts,
  type BusinessExpense,
  type APBillSupplierOption,
  type APBill,
  type AccountMapping,
  type PayeeType,
  type ClearedType,
  type BankAccount,
  fmtMoney,
} from '@/src/libs/data/AccountingV2Data'
import { getAccounts, type Account } from '@/src/libs/data/AccountingData'
import CustomerPicker from '@/src/components/crm/CustomerPicker'
import EmployeePicker from '@/src/components/accounting/EmployeePicker'
import CategorySelect, { type CategorySelectOption } from '@/src/components/ui/CategorySelect'
import { Select } from '@/src/components/ui/Select'
import { ExpenseItemSearchCombobox, type ExpenseItemSearchMeta } from './ExpenseItemSearchCombobox'
import type { SearchComboboxOption } from '@/src/components/ui/SearchCombobox'

const PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'CHECK', 'CARD', 'E_WALLET']

const PAYEE_OPTIONS: { value: PayeeType; label: string }[] = [
  { value: 'CUSTOMER', label: 'Customer' },
  { value: 'SUPPLIER', label: 'Supplier' },
  { value: 'EMPLOYEE', label: 'Employee' },
  { value: 'OTHER', label: 'Other' },
]

const CLEARED_OPTIONS: { value: ClearedType; label: string }[] = [
  { value: 'SAME_DATE', label: 'On the same date' },
  { value: 'LATER_DATE', label: 'On a later date' },
]

// VAT, NON_VAT, EXEMPT — mirrors the backend's free-text taxCode column.
// "Input VAT" is the label, not the stored value: on a purchase, VAT paid is
// input VAT (a claimable asset, account 1-05-010) — the reference tool names
// the code that way and so do we now, but the column keeps its 'VAT' value so
// existing rows stay valid. Its counterpart, Output VAT, is a sales-side
// liability and is deliberately absent — it can never apply to an expense.
const TAX_CODE_OPTIONS = [
  { value: '', label: 'No Tax' },
  { value: 'VAT', label: 'Input VAT' },
  { value: 'NON_VAT', label: 'Non-VAT' },
  { value: 'EXEMPT', label: 'Exempt' },
]

/** The one code that carries a claimable tax amount — everything else is,
 * by definition, a line with no VAT on it. */
const TAXABLE_CODE = 'VAT'

interface LineState {
  categoryAccountId: string
  description: string
  amount: string
  vatAmount: string
  taxCode: string
  // SUPPLIER-only — picking an item prefills categoryAccountId + unitPrice
  // and computes amount as qty * unitPrice (see setLine).
  itemId: string
  itemLabel: string
  qty: string
  unitPrice: string
  // Which Supplier Invoice (AP Bill) this line's purchase is against —
  // candidates come from this line's own Item (see resolveSiForLine),
  // auto-filled when exactly one bill covers it, left for the user to pick
  // among siCandidates[i] otherwise.
  apBillId: string
  apBillLabel: string
}
function emptyLine(): LineState {
  return {
    categoryAccountId: '',
    description: '',
    amount: '',
    vatAmount: '',
    taxCode: '',
    itemId: '',
    itemLabel: '',
    qty: '',
    unitPrice: '',
    apBillId: '',
    apBillLabel: '',
  }
}

// One entry can be paid through several methods at once (e.g. part Cash,
// part Bank Transfer) — rows must sum to the entry's total.
interface PaymentState {
  paymentMethod: string
  bankAccountId: string
  reference: string
  amount: string
}
function emptyPayment(): PaymentState {
  return { paymentMethod: 'CASH', bankAccountId: '', reference: '', amount: '' }
}

/** Mirrors the backend's FLAT_VAT_RATE_PERCENT — the single rate left after
 * the configurable TaxRate table was removed. */
const VAT_RATE_PERCENT = 12

// Line-item table's column templates — one source of truth so the header row
// and every line row always agree. `minmax(0,Nfr)` rather than bare `Nfr`
// (shorthand for `minmax(auto,Nfr)`) is deliberate: a bare `fr` track still
// grows to fit its widest cell's min-content (a long item/account name, a
// long PO code), which pushes that one row out of alignment with the header
// and every other row since each row is its own independent grid. Capping
// the floor at 0 forces columns to actually hold the fr ratio and lets the
// (already-truncating) cell content ellipsize instead.
const ITEM_MODE_GRID_COLS =
  'grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,2fr)_minmax(0,0.6fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1fr)_auto]'
const GENERIC_MODE_GRID_COLS =
  'grid-cols-[minmax(0,2fr)_minmax(0,2.5fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]'

// Accounts come back flat (with a parentId) ordered by account number — turn
// that into the depth-ordered list CategorySelect needs so headers like
// "Less: COST OF SALES" stay directly above their child accounts instead of
// being resorted alphabetically.
function accountsToCategoryOptions(accounts: Account[]): CategorySelectOption[] {
  const idsInList = new Set(accounts.map((a) => a.id))
  const childrenByParent = new Map<string, Account[]>()
  const roots: Account[] = []
  for (const a of accounts) {
    if (a.parentId && idsInList.has(a.parentId)) {
      const siblings = childrenByParent.get(a.parentId) ?? []
      siblings.push(a)
      childrenByParent.set(a.parentId, siblings)
    } else {
      roots.push(a)
    }
  }
  const options: CategorySelectOption[] = []
  const walk = (list: Account[], depth: number) => {
    for (const a of list) {
      // COA code prefix — same "code — name" convention the Supplier picker
      // already uses (see supplierOptions below), so the account's Chart of
      // Accounts number is visible both closed and in the open list, and
      // typing the code into the search box matches it too (plain substring
      // filter on this same string).
      options.push({ id: a.id, name: a.number ? `${a.number} — ${a.name}` : a.name, depth })
      const children = childrenByParent.get(a.id)
      if (children) walk(children, depth + 1)
    }
  }
  walk(roots, 0)
  return options
}

// Scenario 40 (developer feedback, 2026-08-31) — this used to be a modal;
// NIG wants a full page instead, matching the reference accounting tool
// shown at the meeting. Same fields/flow as before, just its own route now:
// /accounting/expenses/new and /accounting/expenses/[id]/edit both render
// this one component, the latter passing expenseId to load the draft first.
//
// Scenario 40 Part 6 (developer feedback, 2026-08-31) — one entry is now a
// header + N lines, matching that same reference tool's "Add line" table:
// the payee is fixed at the header (Customer/Supplier/a free-text Other
// label) and each line picks its own category, splitting one payment
// across expense categories.
export default function ExpenseForm({ expenseId }: { expenseId?: string }) {
  const router = useRouter()
  const [initial, setInitial] = useState<BusinessExpense | null>(null)
  const [ready, setReady] = useState(!expenseId)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [suppliers, setSuppliers] = useState<APBillSupplierOption[]>([])
  const [expenseAccounts, setExpenseAccounts] = useState<Account[]>([])
  const [inventoryAccounts, setInventoryAccounts] = useState<Account[]>([])
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [mappings, setMappings] = useState<AccountMapping[]>([])

  useEffect(() => {
    getAccounts({ limit: 500 }).then((r) => {
      const list = ((r.data as any)?.items ?? r.data ?? []) as Account[]
      setExpenseAccounts(list.filter((a) => (a.type ?? '').toUpperCase() === 'EXPENSE'))
      // A Supplier line can be a real inventory purchase (an Asset, not an
      // Expense) — "1-04-*" is the Inventory account family (Inventory
      // itself, 1-04-000, plus its Appliances/Furniture/Aircon/IT Products
      // children), the only Asset accounts a Supplier expense line should
      // ever offer. Matched by number prefix since the frontend Account
      // type doesn't carry the backend's `category` enum.
      setInventoryAccounts(list.filter((a) => (a.number ?? '').startsWith('1-04')))
    })
    APBillSuppliers.list().then((r) => setSuppliers(r.data?.data ?? []))
    // Payment Method → Bank Transfer unlocks picking which bank account the
    // cash side actually posts to.
    BankAccounts.list().then((r) => setBankAccounts(r.data ?? []))
    // Payee → Supplier line-category default (EXPENSE_SUPPLIER_INVENTORY) —
    // used when a picked Item has no inventory account of its own.
    AccountMappings.list().then((r) => setMappings(r.data ?? []))
  }, [])

  useEffect(() => {
    if (!expenseId) return
    Expenses.get(expenseId).then((res) => {
      if (res.success && res.data) {
        if (res.data.status !== 'DRAFT') {
          setLoadError('Only DRAFT expenses can be edited.')
        } else {
          setInitial(res.data)
        }
      } else {
        setLoadError(res.message || res.error || 'Expense not found.')
      }
      setReady(true)
    })
  }, [expenseId])

  if (!ready) {
    return <div className="px-6 py-8 lg:px-10 text-sm text-gray-400">Loading…</div>
  }
  if (loadError) {
    return (
      <div className="px-6 py-8 lg:px-10">
        <Link
          href="/accounting/expenses"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to expenses
        </Link>
        <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {loadError}
        </div>
      </div>
    )
  }

  return (
    <ExpenseFormFields
      initial={initial}
      suppliers={suppliers}
      expenseAccounts={expenseAccounts}
      inventoryAccounts={inventoryAccounts}
      bankAccounts={bankAccounts}
      mappings={mappings}
      onSaved={() => router.push('/accounting/expenses')}
    />
  )
}

function ExpenseFormFields({
  initial,
  suppliers,
  expenseAccounts,
  inventoryAccounts,
  bankAccounts,
  mappings,
  onSaved,
}: {
  initial: BusinessExpense | null
  suppliers: APBillSupplierOption[]
  expenseAccounts: Account[]
  inventoryAccounts: Account[]
  bankAccounts: BankAccount[]
  mappings: AccountMapping[]
  onSaved: () => void
}) {
  // payeeType derivation for edit mode: new records always carry it; a
  // legacy record (saved before Scenario 40) falls back to whichever link it
  // actually has, defaulting to SUPPLIER to match the old form's default shape.
  const initialPayeeType: PayeeType | '' = initial?.payeeType ?? (initial ? 'SUPPLIER' : '')

  const [form, setForm] = useState({
    expenseDate: initial?.expenseDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    clearedType: (initial?.clearedType ?? 'SAME_DATE') as ClearedType,
    clearedDate: initial?.clearedDate?.slice(0, 10) ?? '',
    payeeType: initialPayeeType,
    supplierId: initial?.supplierId ?? '',
    voucherNumber: initial?.voucherNumber ?? '',
    customerId: initial?.customerId ?? '',
    customerLabel: initial?.customer?.name ?? '',
    employeeId: initial?.employeeId ?? '',
    employeeLabel: initial?.employee
      ? [initial.employee.firstName, initial.employee.lastName].filter(Boolean).join(' ')
      : '',
    payee: initial?.payee ?? '',
    description: initial?.description ?? '',
  })
  const [payments, setPayments] = useState<PaymentState[]>(
    initial?.payments && initial.payments.length > 0
      ? initial.payments.map((p) => ({
          paymentMethod: p.paymentMethod,
          bankAccountId: p.bankAccountId ?? '',
          reference: p.reference ?? '',
          amount: String(p.amount ?? ''),
        }))
      : [emptyPayment()]
  )
  const [lines, setLines] = useState<LineState[]>(
    initial?.lines && initial.lines.length > 0
      ? initial.lines.map((l) => ({
          categoryAccountId: l.categoryAccountId ?? '',
          description: l.description ?? '',
          amount: String(l.amount ?? ''),
          vatAmount: l.taxAmount ? String(l.taxAmount) : '',
          taxCode: l.taxCode ?? '',
          itemId: l.itemId ?? '',
          itemLabel: '',
          qty: l.qty ? String(l.qty) : '',
          unitPrice: l.unitPrice ? String(l.unitPrice) : '',
          // No joined bill number to show yet (apBillId has no relation,
          // same as itemId) — the mount effect below re-resolves it.
          apBillId: l.apBillId ?? '',
          apBillLabel: '',
        }))
      : [emptyLine()]
  )
  const [siCandidates, setSiCandidates] = useState<Record<number, APBill[]>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const categoryOptions = useMemo(
    () => accountsToCategoryOptions(expenseAccounts),
    [expenseAccounts]
  )
  // Supplier lines can be a real inventory purchase — offer the Inventory
  // Asset accounts there too, on top of the usual Expense ones. Every other
  // payee type stays Expense-only (categoryOptions above).
  const supplierCategoryOptions = useMemo(
    () => accountsToCategoryOptions([...expenseAccounts, ...inventoryAccounts]),
    [expenseAccounts, inventoryAccounts]
  )
  // Reuses CategorySelect (flat, depth 0) rather than the plain Select —
  // suppliers grew past a comfortable scroll-and-eyeball list, same reason
  // Category itself is a search box instead of a native <select>.
  const supplierOptions = useMemo(
    () => suppliers.map((s) => ({ id: s.id, name: `${s.code} — ${s.name}`, depth: 0 })),
    [suppliers]
  )
  const bankAccountOptions = useMemo(
    () =>
      bankAccounts.map((a) => ({
        id: a.id,
        // Skip the redundant "Name — Name" when the account's nickname is
        // just the bank's name (the common case) — keeps the single-line
        // select from needing to fit two copies of the same words.
        name:
          a.name === a.bankName
            ? `${a.name} (${a.accountNumber})`
            : `${a.name} — ${a.bankName} (${a.accountNumber})`,
        depth: 0,
      })),
    [bankAccounts]
  )

  // Every payeeType's lines carry their own editable category + Tax — only
  // the header party fields differ (a real Customer/Supplier/Employee link
  // vs. a free-text label).
  const hasOwnCategoryLines =
    form.payeeType === 'CUSTOMER' ||
    form.payeeType === 'SUPPLIER' ||
    form.payeeType === 'EMPLOYEE' ||
    form.payeeType === 'OTHER'
  // SUPPLIER-only — the only payee type that can be a real inventory
  // purchase, so it's the only one that gets an Item/Qty/Unit Price line
  // shape. Everyone else just types a flat Amount.
  const isItemMode = form.payeeType === 'SUPPLIER'
  // Supplier line-category default (Settings → Account Mapping) — used when
  // a picked Item has no inventory account of its own, or no Item is
  // picked yet at all.
  const supplierDefaultAccountId = mappings.find(
    (m) => m.key === 'EXPENSE_SUPPLIER_INVENTORY'
  )?.accountId

  const subtotal = lines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0)
  const vatTotal = lines.reduce((sum, l) => sum + (Number(l.vatAmount) || 0), 0)
  const total = subtotal + vatTotal

  // Item mode computes Amount from Qty * Unit Price. Applied to every line
  // change, not just setLine's — the SI resolver writes a line's price
  // directly, and its Amount has to follow the same rule.
  const withComputedAmount = (l: LineState): LineState => {
    if (!l.itemId || (!l.qty && !l.unitPrice)) return l
    const computed = (Number(l.qty) || 0) * (Number(l.unitPrice) || 0)
    return { ...l, amount: computed ? String(computed) : '' }
  }

  const setLine = (index: number, patch: Partial<LineState>) => {
    setLines((prev) =>
      prev.map((l, i) => {
        if (i !== index) return l
        const next = withComputedAmount({ ...l, ...patch })
        // Moving off Input VAT drops any tax already typed — the backend
        // rejects tax on a non-taxable line (it would have nowhere to post
        // and would unbalance the entry), so the field can't be left holding
        // a stale amount the user can no longer see a reason for.
        if (patch.taxCode !== undefined && patch.taxCode !== TAXABLE_CODE) next.vatAmount = ''
        return next
      })
    )
  }
  const addLine = () =>
    setLines((prev) => [
      ...prev,
      {
        ...emptyLine(),
        categoryAccountId: isItemMode ? (supplierDefaultAccountId ?? '') : '',
        // apBillId stays blank here on purpose — an unused row gets no bill
        // until it actually has an Item on it (see the Item onSelect below).
      },
    ])
  const removeLine = (index: number) => {
    // Both SI maps are keyed by line index, so a removal shifts every line
    // after it out of alignment — drop them and let the resolver effect
    // rebuild from each line's own Item.
    siRequestedRef.current = {}
    setSiCandidates({})
    setLines((prev) => prev.filter((_, i) => i !== index))
  }

  // Backfills any still-blank Supplier line's category once the default
  // mapping loads (async, and may still be loading when the form first
  // renders or when Payee switches to Supplier) — only ever fills a blank,
  // never overwrites a deliberate pick.
  useEffect(() => {
    if (!isItemMode || !supplierDefaultAccountId) return
    setLines((prev) =>
      prev.map((l) =>
        l.categoryAccountId ? l : { ...l, categoryAccountId: supplierDefaultAccountId }
      )
    )
  }, [isItemMode, supplierDefaultAccountId])

  // Supplier Invoice (AP Bill) candidates, per line, keyed on that line's
  // Item — a bill carries no item lines of its own, so the server matches
  // through the PO the bill was raised against (or the goods receipts
  // matched to it). Supplier still scopes the search: a bill billed by a
  // different supplier isn't payable on this expense.
  const resolveSiForLine = async (index: number, itemId: string) => {
    if (!itemId) {
      setSiCandidates((prev) => ({ ...prev, [index]: [] }))
      setLine(index, { apBillId: '', apBillLabel: '' })
      return
    }
    const res = await APBills.list({
      itemId,
      supplierId: form.supplierId || undefined,
    })
    const candidates = res.data?.items ?? []
    setSiCandidates((prev) => ({ ...prev, [index]: candidates }))
    setLines((prev) =>
      prev.map((l, i) => {
        if (i !== index) return l
        // An existing pick (a deliberate choice, or one restored from a
        // saved draft) is kept — this only backfills its label and price,
        // now that the bill is known.
        if (l.apBillId) {
          const picked = candidates.find((c) => c.id === l.apBillId)
          return picked ? withComputedAmount({ ...l, ...billPatch(picked) }) : l
        }
        return candidates.length === 1
          ? withComputedAmount({ ...l, ...billPatch(candidates[0]) })
          : l
      })
    )
  }

  /** What a line takes from the bill it's matched to. The bill's own price
   * for this item beats the item's catalog cost — that catalog figure is
   * just a default for when nothing was actually billed. A zero/absent
   * price means "nothing on record", so the existing price stands. */
  const billPatch = (bill: APBill): Partial<LineState> => {
    const price = bill.matchedItemUnitPrice ?? 0
    return {
      apBillId: bill.id,
      apBillLabel: bill.billNumber ?? '',
      ...(price > 0 ? { unitPrice: String(price) } : {}),
    }
  }

  // A supplier switch invalidates every line's bill (they belonged to the
  // old supplier). Clearing the requested-map too lets the resolver effect
  // below re-run for every line that still has an Item, so "pick items
  // first, supplier after" ends up the same as the reverse order.
  // Keyed by line index → the itemId already looked up for it.
  const siRequestedRef = useRef<Record<number, string>>({})
  const prevSupplierIdRef = useRef(form.supplierId)
  useEffect(() => {
    if (prevSupplierIdRef.current === form.supplierId) return
    prevSupplierIdRef.current = form.supplierId
    siRequestedRef.current = {}
    setSiCandidates({})
    setLines((prev) => prev.map((l) => ({ ...l, apBillId: '', apBillLabel: '' })))
  }, [form.supplierId])

  // Single resolver trigger: any line holding an Item we haven't looked up
  // yet gets resolved, whatever put the Item there — a fresh pick, an
  // edit-mode draft loading, or a hot reload that wiped the candidate list
  // out from under an already-picked row. Keyed by index+itemId so it fires
  // once per item, not once per render.
  useEffect(() => {
    lines.forEach((l, i) => {
      if (!l.itemId || siRequestedRef.current[i] === l.itemId) return
      siRequestedRef.current[i] = l.itemId
      void resolveSiForLine(i, l.itemId)
    })
    // resolveSiForLine is redefined every render; siRequestedRef is what
    // actually gates repeat work, so listing it would only add churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines])

  const setPayment = (index: number, patch: Partial<PaymentState>) => {
    setPayments((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)))
  }
  const addPayment = () => setPayments((prev) => [...prev, emptyPayment()])
  const removePayment = (index: number) => setPayments((prev) => prev.filter((_, i) => i !== index))
  const paymentsTotal = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)

  const validate = (): string | null => {
    if (form.clearedType === 'LATER_DATE' && !form.clearedDate)
      return 'Pick the date this payment is expected to clear.'
    for (const p of payments) {
      if (!p.amount || Number(p.amount) <= 0)
        return 'Every payment method needs an amount greater than 0.'
      if (p.paymentMethod === 'BANK_TRANSFER' && !p.bankAccountId)
        return 'Pick which bank account each Bank Transfer payment is paid from.'
    }
    if (Math.abs(paymentsTotal - total) > 0.01)
      return `Payments total (${fmtMoney(paymentsTotal)}) must equal the expense total (${fmtMoney(total)}).`
    if (!form.payeeType) return 'Choose who this is for (Customer, Supplier, Employee, or Other).'
    if (form.payeeType === 'CUSTOMER' && !form.customerId) return 'Pick a customer.'
    if (form.payeeType === 'EMPLOYEE' && !form.employeeId) return 'Pick an employee.'
    if (form.payeeType === 'OTHER' && !form.payee.trim())
      return 'Describe what this Other expense is for.'
    if (lines.length === 0) return 'Add at least one line.'
    for (const l of lines) {
      if (!l.amount || Number(l.amount) <= 0) return 'Every line needs an amount greater than 0.'
      if (!l.categoryAccountId) return 'Every line needs an account.'
    }
    return null
  }

  const resetLinesForPayeeChange = () => setLines([emptyLine()])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }
    setSaving(true)
    setError(null)
    const payload: Record<string, unknown> = {
      expenseDate: form.expenseDate,
      clearedType: form.clearedType,
      clearedDate: form.clearedType === 'LATER_DATE' ? form.clearedDate : undefined,
      payeeType: form.payeeType,
      description: form.description || undefined,
    }
    payload.payments = payments.map((p) => ({
      paymentMethod: p.paymentMethod,
      bankAccountId: p.paymentMethod === 'BANK_TRANSFER' ? p.bankAccountId || undefined : undefined,
      reference: p.reference || undefined,
      amount: Number(p.amount),
    }))
    if (form.payeeType === 'CUSTOMER') {
      payload.customerId = form.customerId
    } else if (form.payeeType === 'EMPLOYEE') {
      payload.employeeId = form.employeeId
    } else if (form.payeeType === 'SUPPLIER') {
      payload.supplierId = form.supplierId || undefined
      payload.voucherNumber = form.voucherNumber || undefined
    } else {
      // OTHER's free-text payee label — it's the only field OTHER shows at all.
      payload.payee = form.payee || undefined
    }
    payload.lines = lines.map((l) => {
      const line: Record<string, unknown> = {
        categoryAccountId: l.categoryAccountId,
        amount: Number(l.amount),
        description: l.description || undefined,
        taxCode: l.taxCode || undefined,
      }
      if (isItemMode && l.itemId) {
        line.itemId = l.itemId
        if (l.qty) line.qty = Number(l.qty)
        if (l.unitPrice) line.unitPrice = Number(l.unitPrice)
        if (l.apBillId) line.apBillId = l.apBillId
      }
      // Drives the Input VAT debit and the header total server-side.
      const vat = Number(l.vatAmount)
      if (vat > 0) line.taxAmount = vat
      return line
    })

    const res = initial
      ? await Expenses.update(initial.id, payload)
      : await Expenses.create(payload)
    setSaving(false)
    if (!res.success) {
      setError(res.message || res.error || 'Save failed')
      return
    }
    onSaved()
  }

  return (
    <div className="px-6 py-5 lg:px-10">
      <Link
        href="/accounting/expenses"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to expenses
      </Link>

      <h1 className="text-2xl font-semibold text-prominent-purple-900">
        {initial ? 'Edit Expense' : 'New Expense'}
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        Record and categorize a business expense. Recording posts a journal entry to the GL.
      </p>

      <form onSubmit={submit} className="mt-4 space-y-2">
        <div
          className={`grid gap-3 ${form.clearedType === 'LATER_DATE' ? 'grid-cols-3 max-w-2xl' : 'grid-cols-2 max-w-md'}`}
        >
          <Field label="Date *">
            <input
              required
              type="date"
              value={form.expenseDate}
              onChange={(e) => setForm({ ...form, expenseDate: e.target.value })}
              className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
            />
          </Field>
          <Field label="Cleared">
            <Select
              compact
              value={form.clearedType}
              onChange={(value) =>
                setForm({
                  ...form,
                  clearedType: value as ClearedType,
                  clearedDate: value === 'LATER_DATE' ? form.clearedDate : '',
                })
              }
              options={CLEARED_OPTIONS}
            />
          </Field>
          {form.clearedType === 'LATER_DATE' && (
            <Field label="Cleared Date *">
              <input
                required
                type="date"
                value={form.clearedDate}
                onChange={(e) => setForm({ ...form, clearedDate: e.target.value })}
                className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
              />
            </Field>
          )}
        </div>

        {/* Payment Methods — one entry can be paid through several methods at
            once (e.g. part Cash, part Bank Transfer); rows must sum to the
            expense total. */}
        <div className="space-y-2">
          {payments.map((p, i) => (
            <div key={i} className="flex items-end gap-3">
              <div
                className={`grid flex-1 gap-3 ${p.paymentMethod === 'BANK_TRANSFER' ? 'grid-cols-4' : 'grid-cols-3'}`}
              >
                <div>
                  {/* Titles the column on the first row only, so a split
                      payment reads as one source list rather than repeating
                      the heading down every row. Later rows keep an
                      invisible copy of it so their dropdown stays on the
                      same baseline as the Reference/Amount fields beside
                      them. */}
                  <span
                    className={`mb-1 block text-xs font-medium ${i === 0 ? 'text-gray-600' : 'text-transparent select-none'}`}
                    aria-hidden={i > 0}
                  >
                    Paid from
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 text-[13px] font-medium text-zinc-500">{i + 1}.</span>
                    <div className="flex-1">
                      <Select
                        compact
                        value={p.paymentMethod}
                        onChange={(paymentMethod) =>
                          setPayment(i, {
                            paymentMethod,
                            bankAccountId: paymentMethod === 'BANK_TRANSFER' ? p.bankAccountId : '',
                          })
                        }
                        options={PAYMENT_METHODS.map((m) => ({
                          value: m,
                          label: m.replace('_', ' '),
                        }))}
                      />
                    </div>
                  </div>
                </div>
                {p.paymentMethod === 'BANK_TRANSFER' && (
                  <Field label="Bank Account *">
                    <CategorySelect
                      compact
                      aria-label="Select bank account"
                      noun="bank accounts"
                      value={p.bankAccountId}
                      onChange={(id) => setPayment(i, { bankAccountId: id ?? '' })}
                      options={bankAccountOptions}
                      placeholder="— Select —"
                    />
                  </Field>
                )}
                <Field label="Reference Number">
                  <input
                    value={p.reference}
                    onChange={(e) => setPayment(i, { reference: e.target.value })}
                    className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                  />
                </Field>
                <Field label="Amount">
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={p.amount}
                    onChange={(e) => setPayment(i, { amount: e.target.value })}
                    className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                  />
                </Field>
              </div>
              {payments.length > 1 && (
                <button
                  type="button"
                  onClick={() => removePayment(i)}
                  className="mb-0.5 p-1.5 text-red-500 hover:bg-red-50 rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={addPayment}
              className="flex items-center gap-1.5 text-[13px] text-prominent-purple-700 hover:bg-prominent-purple-50 rounded-lg px-2 py-1"
            >
              <Plus className="w-4 h-4" /> Add payment method
            </button>
            {payments.length > 1 && (
              <span
                className={`text-xs ${Math.abs(paymentsTotal - total) > 0.01 ? 'text-amber-600' : 'text-zinc-400'}`}
              >
                Payments total: {fmtMoney(paymentsTotal)} / {fmtMoney(total)}
              </span>
            )}
          </div>
        </div>

        <div
          className={`grid gap-3 ${form.payeeType === 'OTHER' ? 'grid-cols-2 max-w-md' : 'max-w-xs'}`}
        >
          <Field label="Payee *">
            <Select
              compact
              value={form.payeeType}
              onChange={(value) => {
                setForm({
                  ...form,
                  payeeType: value as PayeeType,
                  customerId: '',
                  customerLabel: '',
                  supplierId: '',
                  voucherNumber: '',
                  employeeId: '',
                  employeeLabel: '',
                  payee: '',
                })
                resetLinesForPayeeChange()
              }}
              options={PAYEE_OPTIONS}
              placeholder="— Select —"
            />
          </Field>

          {form.payeeType === 'OTHER' && (
            <Field label="Other Category *">
              <input
                value={form.payee}
                onChange={(e) => setForm({ ...form, payee: e.target.value })}
                className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
              />
            </Field>
          )}
        </div>

        {form.payeeType === 'CUSTOMER' && (
          <div className="max-w-md">
            <Field label="Customer *">
              <CustomerPicker
                compact
                value={form.customerId}
                selectedLabel={form.customerLabel}
                onChange={(customerId, label) =>
                  setForm({ ...form, customerId, customerLabel: label })
                }
              />
            </Field>
          </div>
        )}

        {form.payeeType === 'EMPLOYEE' && (
          <div className="max-w-md">
            <Field label="Employee *">
              <EmployeePicker
                compact
                value={form.employeeId}
                selectedLabel={form.employeeLabel}
                onChange={(employeeId, label) =>
                  setForm({ ...form, employeeId, employeeLabel: label })
                }
              />
            </Field>
          </div>
        )}

        {form.payeeType === 'SUPPLIER' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Supplier">
              <CategorySelect
                compact
                aria-label="Select supplier"
                noun="suppliers"
                value={form.supplierId}
                onChange={(id) => setForm({ ...form, supplierId: id ?? '' })}
                options={supplierOptions}
                placeholder="— None —"
              />
            </Field>
            <Field label="Voucher #">
              <input
                value={form.voucherNumber}
                onChange={(e) => setForm({ ...form, voucherNumber: e.target.value })}
                className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
              />
            </Field>
          </div>
        )}

        {/* Line items — Scenario 40 Part 6. Supplier is the only payee type
            that can be a real inventory purchase, so it's the only one that
            gets the Item/Qty/Unit Price columns; every other type just
            picks a Category and types a flat Amount. */}
        {hasOwnCategoryLines && (
          <div className="pt-2">
            <div
              className={`grid gap-2 rounded-lg bg-zinc-50 py-1.5 text-xs font-medium text-zinc-500 ${
                isItemMode ? ITEM_MODE_GRID_COLS : GENERIC_MODE_GRID_COLS
              }`}
            >
              {isItemMode && (
                <>
                  <div>Item</div>
                  <div>SI</div>
                </>
              )}
              <div>Account</div>
              {isItemMode ? (
                <>
                  <div>Qty</div>
                  <div>Unit Price</div>
                </>
              ) : (
                <div>Description</div>
              )}
              <div>Amount</div>
              <div>Tax Code</div>
              <div>Tax Amount</div>
              <div>Total</div>
              <div />
            </div>
            <div className="divide-y divide-zinc-100">
              {lines.map((line, i) => {
                const lineTotal = (Number(line.amount) || 0) + (Number(line.vatAmount) || 0)
                return (
                  <div
                    key={i}
                    className={`grid gap-2 items-center py-1.5 ${
                      isItemMode ? ITEM_MODE_GRID_COLS : GENERIC_MODE_GRID_COLS
                    }`}
                  >
                    {isItemMode && (
                      <>
                        <ExpenseItemSearchCombobox
                          value={line.itemId}
                          initialLabel={line.itemLabel}
                          onChange={(id) => {
                            if (!id) {
                              delete siRequestedRef.current[i]
                              setLine(i, { itemId: '', unitPrice: '', qty: '' })
                              void resolveSiForLine(i, '')
                            }
                          }}
                          onSelect={(option: SearchComboboxOption) => {
                            const meta = option.meta as ExpenseItemSearchMeta
                            setLine(i, {
                              itemId: option.id,
                              itemLabel: option.primary,
                              unitPrice: meta.costPrice ? String(meta.costPrice) : line.unitPrice,
                              qty: line.qty || '1',
                              categoryAccountId:
                                meta.inventoryAccountId ??
                                supplierDefaultAccountId ??
                                line.categoryAccountId,
                              // A new item means a new bill context — drop
                              // the old pick; the resolver effect fills in
                              // the one that actually covers this item.
                              apBillId: '',
                              apBillLabel: '',
                            })
                          }}
                        />
                        <CategorySelect
                          compact
                          aria-label="Supplier Invoice"
                          noun="invoices"
                          value={line.apBillId}
                          onChange={(id) => {
                            const bill = (siCandidates[i] ?? []).find((b) => b.id === id)
                            setLine(i, bill ? billPatch(bill) : { apBillId: '', apBillLabel: '' })
                          }}
                          options={(siCandidates[i] ?? []).map((b) => ({
                            id: b.id,
                            name: b.billNumber ?? '(no invoice #)',
                            depth: 0,
                          }))}
                          placeholder="— None —"
                        />
                      </>
                    )}
                    <CategorySelect
                      compact
                      aria-label="Account"
                      noun="accounts"
                      value={line.categoryAccountId}
                      onChange={(id) => setLine(i, { categoryAccountId: id ?? '' })}
                      options={isItemMode ? supplierCategoryOptions : categoryOptions}
                      placeholder="— Select —"
                    />
                    {isItemMode ? (
                      <>
                        <input
                          type="number"
                          step="1"
                          min="0"
                          aria-label="Quantity"
                          value={line.qty}
                          onChange={(e) => setLine(i, { qty: e.target.value })}
                          className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                        />
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          aria-label="Unit price"
                          value={line.unitPrice}
                          onChange={(e) => setLine(i, { unitPrice: e.target.value })}
                          className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                        />
                      </>
                    ) : (
                      <input
                        aria-label="Line description"
                        value={line.description}
                        onChange={(e) => setLine(i, { description: e.target.value })}
                        className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                      />
                    )}
                    <input
                      required
                      type="number"
                      step="0.01"
                      min="0.01"
                      aria-label="Amount"
                      readOnly={isItemMode && !!line.itemId}
                      value={line.amount}
                      onChange={(e) => setLine(i, { amount: e.target.value })}
                      className={`w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500 ${
                        isItemMode && line.itemId ? 'bg-zinc-50 text-zinc-500' : ''
                      }`}
                    />
                    <Select
                      compact
                      value={line.taxCode}
                      onChange={(taxCode) => setLine(i, { taxCode })}
                      options={TAX_CODE_OPTIONS}
                    />
                    {/* Only an Input VAT line can carry a tax amount —
                          the others have no VAT by definition, so the field
                          is locked rather than left open to an entry the
                          backend will reject on save. */}
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      aria-label="Tax amount"
                      readOnly={line.taxCode !== TAXABLE_CODE}
                      value={line.vatAmount}
                      onChange={(e) => setLine(i, { vatAmount: e.target.value })}
                      placeholder={line.taxCode === TAXABLE_CODE ? '0.00' : ''}
                      title={
                        line.taxCode === TAXABLE_CODE
                          ? undefined
                          : 'Set the tax code to Input VAT to enter a tax amount'
                      }
                      className={`w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500 ${
                        line.taxCode !== TAXABLE_CODE ? 'bg-zinc-50 text-zinc-400' : ''
                      }`}
                    />
                    <div className="min-w-0 truncate px-2.5 py-1.5 text-[13px] text-zinc-600">
                      {fmtMoney(lineTotal)}
                    </div>
                    <div className="flex justify-end">
                      {lines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeLine(i)}
                          className="p-1 text-red-500 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            <button
              type="button"
              onClick={addLine}
              className="mt-1.5 flex items-center gap-1.5 text-[13px] text-prominent-purple-700 hover:bg-prominent-purple-50 rounded-lg px-2 py-1"
            >
              <Plus className="w-4 h-4" /> Add line
            </button>
          </div>
        )}

        <Field label="Description">
          <input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
          />
        </Field>
        <div className="space-y-0.5 text-right text-sm text-gray-600">
          {vatTotal > 0 && (
            <>
              <div>
                Subtotal: <span className="font-medium">{fmtMoney(subtotal)}</span>
              </div>
              <div>
                VAT ({VAT_RATE_PERCENT}%): <span className="font-medium">{fmtMoney(vatTotal)}</span>
              </div>
            </>
          )}
          <div>
            Total: <span className="font-semibold">{fmtMoney(total)}</span>
          </div>
        </div>
        {error && (
          <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
            {error}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-3 border-t border-zinc-200">
          <Link
            href="/accounting/expenses"
            className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800 disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-600 mb-1">{label}</span>
      {children}
    </label>
  )
}
