'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Check, Copy, Loader2, Plus, Trash2, Upload } from 'lucide-react'
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
import { customersApi } from '@/src/libs/api/crm'
import EmployeePicker from '@/src/components/accounting/EmployeePicker'
import CategorySelect, { type CategorySelectOption } from '@/src/components/ui/CategorySelect'
import { Select } from '@/src/components/ui/Select'
import {
  BranchesApi,
  DepartmentsApi,
  divisionIdsFor,
  divisionOptions,
  divisionValueFor,
  type BranchLite,
  type Department,
} from '@/src/libs/data/OrgStructureData'
import { ExpenseItemSearchCombobox, type ExpenseItemSearchMeta } from './ExpenseItemSearchCombobox'
import { importSpreadsheetLines, type ImportResult } from './importSpreadsheetLines'
import { SpecialAccountPicker } from './SpecialAccountPicker'
import { downloadCsv } from '@/src/libs/format/csv-export'
import type { SearchComboboxOption } from '@/src/components/ui/SearchCombobox'

// Ties the sticky header's Save to the <form> further down, which it sits
// outside of.
const FORM_ID = 'expense-form'

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
/** Mirrors the backend's FLAT_VAT_RATE_PERCENT — the single rate left after
 * the configurable TaxRate table was removed. */
const VAT_RATE_PERCENT = 12

const TAX_CODE_OPTIONS = [
  { value: '', label: 'No Tax' },
  { value: 'VAT', label: 'Input VAT' },
  { value: 'NON_VAT', label: 'Non-VAT' },
  { value: 'EXEMPT', label: 'Exempt' },
]

/** The one code that carries a claimable tax amount — everything else is,
 * by definition, a line with no VAT on it. */
const TAXABLE_CODE = 'VAT'

/**
 * Payroll lives at Payee → Other with this typed into Other Category, and
 * nothing else in the app turns those columns on. Matching the typed word
 * rather than offering a dropdown is deliberate: Other Category stays the
 * free-text box it has always been, and `PAYROLL` is a real backend
 * otherCategory, so the word the clerk types is what gets stored.
 *
 * Interim: a spreadsheet import parked under a category, until payroll gets
 * a screen of its own.
 */
/** The one Category worth recording today — it marks an entry as a payroll
 * run. It changes no fields; see OTHER_CATEGORY_OPTIONS. */
const PAYROLL_CATEGORY = 'PAYROLL'

/**
 * Payee → Other's sub-choice. It marks what the entry *is* — so a payroll
 * run can be told apart from any other Other expense later — and nothing
 * more: both categories get identical fields, because the columns are
 * driven by the account on each line, not by the header.
 *
 * UTILITIES and SALARIES_WAGES are real backend categories left out
 * deliberately: they only ever prefilled a default line account, which the
 * Account picker does directly. SPECIAL_ACCOUNTS is out too — it needs a
 * specialAccountType this screen has no picker for, so offering it would
 * only produce a rejected save.
 */
const OTHER_CATEGORY_OPTIONS = [
  { value: '', label: '— None —' },
  { value: PAYROLL_CATEGORY, label: 'Payroll' },
]

/** VAT a line attracts, derived from its code rather than typed. The server
 * computes the same figure from the same code and ignores any amount sent
 * with it, so a hand-typed VAT could only ever disagree with what actually
 * posts. A deduction (negative amount) is not a purchase and never carries
 * input VAT. */
function vatFor(line: { taxCode: string; amount: string }): number {
  const amount = Number(line.amount) || 0
  if (line.taxCode !== TAXABLE_CODE || amount < 0) return 0
  return Math.round(amount * (VAT_RATE_PERCENT / 100) * 100) / 100
}

interface LineState {
  categoryAccountId: string
  /** Which named balance this line belongs to, under its own account —
   * a person for an advance or a loan, a project for capital expenditure.
   * Stored as free text and matched by name, which is what ties a recovery
   * back to that balance. Only meaningful on an account that keeps a
   * subsidiary ledger; `isSpecialAccount` is derived from it on submit. */
  payee: string
  /** The Division picker's value — `branch:<id>` or `department:<id>`,
   * unpacked into the two ids the API takes on submit. */
  division: string
  /** Which customer this line collects from, when it is a payroll
   * deduction of their monthly instalment. Recording the expense settles
   * their instalment dues; blank means it settles nobody's. */
  collectFromId: string
  collectFromLabel: string
  description: string
  amount: string
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
    payee: '',
    division: '',
    collectFromId: '',
    collectFromLabel: '',
    description: '',
    amount: '',
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
// Payee → Other's shape: the generic one plus Special Account and Division.
// A Customer, Supplier or Employee expense has no use for either.
const OTHER_MODE_GRID_COLS =
  'grid-cols-[minmax(0,1.7fr)_minmax(0,1.8fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1.4fr)_auto]'

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
  const [postableAccounts, setPostableAccounts] = useState<Account[]>([])
  const [inventoryAccounts, setInventoryAccounts] = useState<Account[]>([])
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [mappings, setMappings] = useState<AccountMapping[]>([])

  useEffect(() => {
    getAccounts({ limit: 500 }).then((r) => {
      const list = ((r.data as any)?.items ?? r.data ?? []) as Account[]
      // Not expenses only. A payroll run credits assets and liabilities as
      // well as debiting expense — the client's own disbursement sheet
      // posts to Accounts receivable - MI (asset), Pag-IBIG Premium
      // Payable and Withholding Tax Payable Wages (liabilities), and their
      // reference tool lets those be picked here directly. Restricting the
      // picker to EXPENSE made every one of them unreachable.
      //
      // Header rows aren't postable, so they stay out. Equity is excluded
      // too: nothing an expense entry does belongs there.
      const postable = list.filter((a) => {
        const type = (a.type ?? '').toUpperCase()
        const isHeader = (a.number ?? '').endsWith('-000')
        return !isHeader && type !== 'EQUITY'
      })
      setPostableAccounts(postable)
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
      postableAccounts={postableAccounts}
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
  postableAccounts,
  inventoryAccounts,
  bankAccounts,
  mappings,
  onSaved,
}: {
  initial: BusinessExpense | null
  suppliers: APBillSupplierOption[]
  postableAccounts: Account[]
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
    otherCategory: initial?.otherCategory ?? '',
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
          payee: l.payee || (l.employee ? `${l.employee.firstName} ${l.employee.lastName}` : ''),
          division: divisionValueFor(l),
          collectFromId: (l as any).customerId ?? '',
          collectFromLabel: (l as any).customer?.name ?? '',
          description: l.description ?? '',
          amount: String(l.amount ?? ''),
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
  // A line's Division is one pick from the tenant's branches and departments
  // listed together — "dropdown came from branches and departments". Loaded
  // once here and shared by every line.
  const [branches, setBranches] = useState<BranchLite[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([])
  useEffect(() => {
    BranchesApi.list().then((r) => setBranches(r.data?.data ?? []))
    DepartmentsApi.list().then((r) => setDepartments(r.data?.data ?? []))
    // Only used to pre-fill "collect from" on import — the picker itself
    // searches server-side, so this list never has to be complete.
    customersApi
      .list({ limit: 1000 })
      .then((r) => setCustomers((r.data?.data ?? []).map((c) => ({ id: c.id, name: c.name }))))
  }, [])
  const divisionChoices = useMemo(
    () => divisionOptions(branches, departments),
    [branches, departments]
  )

  // Spreadsheet import. The payroll disbursement sheet runs to hundreds of
  // rows, so it is read in the browser and dropped straight into the line
  // table for review — nothing is saved until the user hits Save, and
  // nothing leaves the page.
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)

  const handleImport = async (file: File) => {
    setImporting(true)
    setError(null)
    try {
      const result = await importSpreadsheetLines(
        file,
        postableAccounts,
        divisionChoices,
        customers
      )
      if (result.lines.length === 0) {
        setError('No lines found in that file — expected Account, Particulars, Debit, Credit.')
        setImportResult(null)
        return
      }
      setLines(
        result.lines.map((l) => ({
          ...emptyLine(),
          categoryAccountId: l.categoryAccountId,
          collectFromId: l.collectFromId,
          collectFromLabel: l.collectFromLabel,
          division: l.division,
          payee: l.payee,
          description: l.description,
          amount: l.amount,
        }))
      )
      setImportResult(result)
    } catch {
      setError('Could not read that file. Expected a .xlsx or .csv spreadsheet.')
      setImportResult(null)
    } finally {
      setImporting(false)
      // Let the same file be re-picked after a correction.
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // An ordinary expense line posts to an expense account, which is all this
  // picker ever offered. Payroll is the one exception below.
  const expenseAccounts = useMemo(
    () => postableAccounts.filter((a) => (a.type ?? '').toUpperCase() === 'EXPENSE'),
    [postableAccounts]
  )
  const categoryOptions = useMemo(
    () => accountsToCategoryOptions(expenseAccounts),
    [expenseAccounts]
  )
  // Payee → Other only. These entries credit assets and liabilities as well
  // as debiting expense — a payroll run touches the receivable and both
  // statutory payables — so they need the full postable list. Widening it
  // for every expense made the picker unusable.
  const ledgerCategoryOptions = useMemo(
    () => accountsToCategoryOptions(postableAccounts),
    [postableAccounts]
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
  // Payee -> Other -> "Payroll". The spreadsheet import and the Special
  // Account / Name / Division columns exist for a payroll run and nothing
  // else, so they are rendered here and nowhere else.
  // Payee → Other is what turns on the ledger columns — Special Account,
  // Division, the spreadsheet import, negative amounts. Not the Category:
  // both categories get identical fields, and whether a given line has a
  // Special Account to pick is decided by its own account. Category only
  // records what the entry is.
  const isOtherMode = form.payeeType === 'OTHER'
  // The one thing Category does change. The importer reads a payroll
  // disbursement sheet specifically — its column order, its summary rows,
  // its region suffixes — so offering it on any other Other expense invites
  // a file it has no way to understand.
  const isPayrollCategory = isOtherMode && form.otherCategory === PAYROLL_CATEGORY
  // Accounts that keep one balance per named person or project. Only a line
  // posting to one of these has a Special Account to pick; everywhere else
  // the account total is the whole story.
  const specialAccountControlIds = useMemo(
    () => new Set(postableAccounts.filter((a) => a.isSpecialAccountControl).map((a) => a.id)),
    [postableAccounts]
  )
  // Supplier line-category default (Settings → Account Mapping) — used when
  // a picked Item has no inventory account of its own, or no Item is
  // picked yet at all.
  const supplierDefaultAccountId = mappings.find(
    (m) => m.key === 'EXPENSE_SUPPLIER_INVENTORY'
  )?.accountId

  const subtotal = lines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0)
  const vatTotal = lines.reduce((sum, l) => sum + vatFor(l), 0)
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
  // The figure every payment has to add up to, repeated beside the payment
  // rows because that is where it gets typed — the totals block sits below
  // hundreds of imported lines, well off screen by then. Rendered unformatted
  // so it pastes straight into the Amount box, and `select-all` makes one
  // click take the whole number.
  const [copiedTotal, setCopiedTotal] = useState(false)
  const copyTotal = async () => {
    try {
      await navigator.clipboard.writeText(total.toFixed(2))
      setCopiedTotal(true)
      setTimeout(() => setCopiedTotal(false), 1500)
    } catch {
      // Clipboard can be blocked; the number is selectable either way.
    }
  }

  // Lets the sticky header's Save submit a form it sits outside of.
  const formRef = useRef<HTMLFormElement>(null)

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
      return 'Name the payee — who the money went to.'
    if (lines.length === 0) return 'Add at least one line.'
    for (const l of lines) {
      // Only a Payee → Other entry deducts (a payroll withholding, an advance
      // taken back). Elsewhere a line is money going out, so a negative is a
      // mis-key.
      if (isOtherMode) {
        if (l.amount === '' || !Number.isFinite(Number(l.amount)) || Number(l.amount) === 0)
          return 'Every line needs an amount — positive to add, negative to deduct.'
      } else if (!l.amount || Number(l.amount) <= 0) {
        return 'Every line needs an amount greater than 0.'
      }
      if (!l.categoryAccountId) return 'Every line needs an account.'
    }
    // The entry as a whole has to be money going out: record() credits cash
    // for the total, and deductions exceeding what they deduct from is a
    // mis-key. The server rejects it too. Unreachable off payroll, where
    // every line is already required to be positive.
    if (total <= 0) return 'Deductions cannot meet or exceed the amounts they deduct from.'
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
    // The one document number for the whole entry, whoever it was paid to.
    payload.voucherNumber = form.voucherNumber || undefined
    if (form.payeeType === 'CUSTOMER') {
      payload.customerId = form.customerId
    } else if (form.payeeType === 'EMPLOYEE') {
      payload.employeeId = form.employeeId
    } else if (form.payeeType === 'SUPPLIER') {
      payload.supplierId = form.supplierId || undefined
    } else {
      // The payee's own name — "NIG EMPLOYEES" on the client's payroll
      // voucher, and what the printed voucher shows as the payee.
      payload.payee = form.payee || undefined
      payload.otherCategory = form.otherCategory || undefined
    }
    payload.lines = lines.map((l) => {
      const line: Record<string, unknown> = {
        amount: Number(l.amount),
        description: l.description || undefined,
        taxCode: l.taxCode || undefined,
      }
      line.categoryAccountId = l.categoryAccountId
      // Special Account, Division, and the customer a deduction collects from
      // belong to Payee → Other alone. Nothing else renders them, so nothing
      // else sends them — any value left in state from a payee type that was
      // since changed is dropped here.
      if (isOtherMode) {
        // Only a deduction can collect — a positive line would be issuing
        // money, not receiving it.
        if (l.collectFromId && Number(l.amount) < 0) line.customerId = l.collectFromId
        if (l.payee.trim()) {
          line.payee = l.payee.trim()
          // Derived, not stored separately: a name under a control account
          // IS a special-account line. The two can no longer disagree.
          if (specialAccountControlIds.has(l.categoryAccountId)) line.isSpecialAccount = true
        }
        Object.assign(line, divisionIdsFor(l.division))
      }
      if (isItemMode && l.itemId) {
        line.itemId = l.itemId
        if (l.qty) line.qty = Number(l.qty)
        if (l.unitPrice) line.unitPrice = Number(l.unitPrice)
        if (l.apBillId) line.apBillId = l.apBillId
      }
      // taxAmount is deliberately not sent: the server derives it from
      // taxCode and ignores anything supplied, so sending one would only
      // create a figure that could disagree with what posts.
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
      {/* The header sticks, and carries its own Save. A payroll entry runs to
          one line per division — the client's own disbursement sheet has 58 —
          so the actions at the foot of the form sat several screens below the
          field being edited, and saving meant scrolling the whole list.

          The heading block sits outside the <form> it submits, so Save calls
          requestSubmit() on a ref rather than relying on the `form=`
          attribute — requestSubmit fires onSubmit and runs native validation
          exactly as an in-form button would, with no dependency on how the
          renderer treats that prop. */}
      <div className="sticky top-0 z-20 -mx-6 -mt-5 mb-4 border-b border-zinc-200 bg-zinc-50/95 px-6 pb-3 pt-5 backdrop-blur lg:-mx-10 lg:px-10">
        <Link
          href="/accounting/expenses"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to expenses
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-prominent-purple-900">
              {initial ? 'Edit Expense' : 'New Expense'}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Record and categorize a business expense. Recording posts a journal entry to the GL.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 pt-1">
            <Link
              href="/accounting/expenses"
              className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            >
              Cancel
            </Link>
            <button
              type="button"
              onClick={() => formRef.current?.requestSubmit()}
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800 disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

        {/* Beside the button that produced it. Validation refuses the save
            without moving the page, so a message at the foot of the form was
            off-screen for anything longer than a viewport — the save read as
            simply not working. */}
        {error && (
          <div
            role="alert"
            className="mt-3 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700"
          >
            {error}
          </div>
        )}
      </div>

      <form ref={formRef} id={FORM_ID} onSubmit={submit} className="mt-4 space-y-2">
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
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <button
              type="button"
              onClick={addPayment}
              className="flex items-center gap-1.5 text-[13px] text-prominent-purple-700 hover:bg-prominent-purple-50 rounded-lg px-2 py-1"
            >
              <Plus className="w-4 h-4" /> Add payment method
            </button>
            <div className="flex items-center gap-3">
              {payments.length > 1 && (
                <span
                  className={`text-xs ${Math.abs(paymentsTotal - total) > 0.01 ? 'text-amber-600' : 'text-zinc-400'}`}
                >
                  Payments total: {fmtMoney(paymentsTotal)} / {fmtMoney(total)}
                </span>
              )}
              {total > 0 && (
                <span className="flex items-center gap-1.5 text-xs text-zinc-500">
                  Amount total
                  <span className="select-all font-medium tabular-nums text-zinc-700">
                    {total.toFixed(2)}
                  </span>
                  <button
                    type="button"
                    onClick={copyTotal}
                    aria-label="Copy amount total"
                    title="Copy — paste into Amount"
                    className="rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                  >
                    {copiedTotal ? (
                      <Check className="h-3.5 w-3.5 text-green-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </span>
              )}
            </div>
          </div>
        </div>

        <div
          className={`grid gap-3 ${
            form.payeeType === 'OTHER' ? 'grid-cols-4 max-w-4xl' : 'grid-cols-2 max-w-md'
          }`}
        >
          {/* Unlabelled when the free-text Payee sits beside it — that box
              carries the label for the pair, the way the client's own screen
              reads "Contact | Other | NIG EMPLOYEES". */}
          <Field label={form.payeeType === 'OTHER' ? '' : 'Payee *'}>
            <Select
              compact
              aria-label="Payee type"
              value={form.payeeType}
              onChange={(value) => {
                setForm({
                  ...form,
                  payeeType: value as PayeeType,
                  customerId: '',
                  customerLabel: '',
                  supplierId: '',
                  employeeId: '',
                  employeeLabel: '',
                  payee: '',
                  otherCategory: '',
                })
                resetLinesForPayeeChange()
              }}
              options={PAYEE_OPTIONS}
              placeholder="— Select —"
            />
          </Field>

          {form.payeeType === 'OTHER' && (
            <>
              {/* Who the money went to. Not a category — this is the name
                  the printed voucher shows as the payee. */}
              <Field label="Payee *">
                <input
                  value={form.payee}
                  onChange={(e) => setForm({ ...form, payee: e.target.value })}
                  placeholder="e.g. NIG EMPLOYEES"
                  className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                />
              </Field>
              <Field label="Category">
                <Select
                  compact
                  aria-label="Other category"
                  value={form.otherCategory}
                  onChange={(otherCategory) => setForm({ ...form, otherCategory })}
                  options={OTHER_CATEGORY_OPTIONS}
                />
              </Field>
            </>
          )}
          {/* The printed voucher's "VOUCHER #" — the one document number for
              the whole entry, distinct from each payment's own Reference
              (the client's payroll voucher carries UB#0826-P2 against a
              reference of UB#0826-02P). Optional, and offered for every
              payee type: any disbursement can be raised against a voucher,
              not just a supplier's. */}
          <Field label="Voucher #">
            <input
              value={form.voucherNumber}
              onChange={(e) => setForm({ ...form, voucherNumber: e.target.value })}
              className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
            />
          </Field>
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
          <div className="max-w-md">
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
          </div>
        )}

        <Field label="Description">
          <input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
          />
        </Field>

        {/* Line items — Scenario 40 Part 6. Supplier is the only payee type
            that can be a real inventory purchase, so it's the only one that
            gets the Item/Qty/Unit Price columns; every other type just
            picks a Category and types a flat Amount. */}
        {hasOwnCategoryLines && (
          <div className="pt-2">
            <div
              className={`grid gap-2 rounded-lg bg-zinc-50 py-1.5 text-xs font-medium text-zinc-500 ${
                isItemMode
                  ? ITEM_MODE_GRID_COLS
                  : isOtherMode
                    ? OTHER_MODE_GRID_COLS
                    : GENERIC_MODE_GRID_COLS
              }`}
            >
              {isItemMode && (
                <>
                  <div>Item</div>
                  <div>SI</div>
                </>
              )}
              <div>Account</div>
              {isOtherMode && <div>Special Account</div>}
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
              {/* One pick from the branches and departments list — per line,
                  because a payroll run spans every department it pays. */}
              {isOtherMode && <div>Division</div>}
              <div />
            </div>
            <div className="divide-y divide-zinc-100">
              {lines.map((line, i) => {
                const lineTotal = (Number(line.amount) || 0) + vatFor(line)
                return (
                  <div
                    key={i}
                    className={`grid gap-2 items-center py-1.5 ${
                      isItemMode
                        ? ITEM_MODE_GRID_COLS
                        : isOtherMode
                          ? OTHER_MODE_GRID_COLS
                          : GENERIC_MODE_GRID_COLS
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
                      options={
                        isItemMode
                          ? supplierCategoryOptions
                          : isOtherMode
                            ? ledgerCategoryOptions
                            : categoryOptions
                      }
                      placeholder="— Select —"
                    />
                    {/* Which named balance the line belongs to, under whichever
                        control account the Account picker chose. Inert on an
                        account that keeps no such ledger. */}
                    {isOtherMode && (
                      <div className="min-w-0">
                        <SpecialAccountPicker
                          value={{
                            name: line.payee,
                            customerId: line.collectFromId,
                            customerLabel: line.collectFromLabel,
                          }}
                          onChange={(v) =>
                            setLine(i, {
                              payee: v.name,
                              collectFromId: v.customerId,
                              collectFromLabel: v.customerLabel,
                            })
                          }
                          accountId={line.categoryAccountId}
                          disabled={!specialAccountControlIds.has(line.categoryAccountId)}
                        />
                      </div>
                    )}
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
                    {/* Payee → Other alone can go negative — a payroll
                        sheet's Credit column (statutory withholding, an
                        advance taken back out of pay), which needs no min to
                        stay typeable. Every other payee keeps its floor. */}
                    <input
                      required
                      type="number"
                      step="0.01"
                      min={isOtherMode ? undefined : '0.01'}
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
                    <div
                      aria-label="Tax amount"
                      title={
                        line.taxCode === TAXABLE_CODE
                          ? `${VAT_RATE_PERCENT}% of the line amount, computed on save`
                          : 'No VAT on this tax code'
                      }
                      className={`min-w-0 truncate px-2.5 py-1.5 text-[13px] ${
                        vatFor(line) > 0 ? 'text-zinc-600' : 'text-zinc-400'
                      }`}
                    >
                      {vatFor(line) > 0 ? fmtMoney(vatFor(line)) : '—'}
                    </div>
                    <div className="min-w-0 truncate px-2.5 py-1.5 text-[13px] text-zinc-600">
                      {fmtMoney(lineTotal)}
                    </div>
                    {isOtherMode && (
                      <Select
                        compact
                        value={line.division}
                        onChange={(division) => setLine(i, { division })}
                        options={divisionChoices.map((d) => ({
                          value: d.value,
                          label: d.label,
                        }))}
                        placeholder="— None —"
                      />
                    )}
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
            {/* Category = Payroll only. A 659-row disbursement sheet is the
                reason this exists, and the parser is built around that
                sheet's own shape; anything else is a handful of lines typed
                straight in. */}
            {isPayrollCategory && (
              <>
                {/* Import sits with Add line: both are ways of getting rows into
                  the table, and the imported rows are ordinary editable lines
                  once they land. */}
                <div className="mt-1.5 flex flex-wrap items-center gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    aria-label="Import lines from a spreadsheet"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleImport(file)
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={importing}
                    className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[13px] text-prominent-purple-700 hover:bg-prominent-purple-50 disabled:opacity-60"
                  >
                    {importing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    {importing ? 'Reading…' : 'Import from spreadsheet'}
                  </button>
                  {/* Same affordance the inventory bulk-import modals offer: a
                    template in the exact column order the parser reads, so
                    nobody has to guess it from a tooltip. */}
                  <button
                    type="button"
                    onClick={() =>
                      downloadCsv(
                        'expense-lines-template.csv',
                        ['Account', 'Particulars / Memo', 'Debit', 'Credit'],
                        [
                          ['Salaries and Wages', 'ACCOUNTING & FINANCE-NEGROS', 41008.47, ''],
                          ['Employee Cash Advance', 'DELA CRUZ, JUAN', '', 2500],
                        ]
                      )
                    }
                    className="rounded-lg px-2 py-1 text-[13px] text-prominent-purple-700 hover:bg-prominent-purple-50"
                  >
                    Download template
                  </button>
                  <span className="text-[11px] text-zinc-400">
                    Account · Particulars · Debit · Credit — replaces the lines below
                  </span>
                </div>

                {importResult && (
                  <div className="mt-2 rounded-lg border border-prominent-purple-100 bg-prominent-purple-50/40 p-2.5 text-[12px] text-zinc-700">
                    <p className="font-medium">
                      Imported {importResult.lines.length} of {importResult.rowsRead} rows.
                    </p>
                    {importResult.skippedEmptyRows > 0 && (
                      <p className="mt-0.5 text-zinc-500">
                        {importResult.skippedEmptyRows} row(s) carried no amount — the sheet&apos;s
                        own header row, and any row whose debit and credit cancel out.
                      </p>
                    )}
                    {importResult.skippedSummaryRows.length > 0 && (
                      <p className="mt-0.5 text-zinc-500">
                        Skipped {importResult.skippedSummaryRows.join(', ')} — totals, not
                        transactions. The payment above covers the cash side.
                      </p>
                    )}
                    {importResult.unmatchedAccounts.length > 0 && (
                      <p className="mt-0.5 text-amber-700">
                        No matching account for {importResult.unmatchedAccounts.join(', ')} — those
                        lines need an Account picked before saving.
                      </p>
                    )}
                    {importResult.matchedCustomers > 0 && (
                      <p className="mt-0.5 text-zinc-500">
                        {importResult.matchedCustomers} deduction(s) matched a customer and will
                        settle their instalments on save.
                      </p>
                    )}
                    {importResult.unmatchedDivisions.length > 0 && (
                      <p className="mt-0.5 text-zinc-500">
                        {importResult.unmatchedDivisions.length} value(s) matched no Division and
                        went to Description instead — check whether any is a division you are
                        missing: {importResult.unmatchedDivisions.slice(0, 6).join(', ')}
                        {importResult.unmatchedDivisions.length > 6 &&
                          ` and ${importResult.unmatchedDivisions.length - 6} more`}
                        . Names on advance and loan lines are not counted here — those are Special
                        Accounts, not missed divisions.
                      </p>
                    )}
                  </div>
                )}
              </>
            )}

            <button
              type="button"
              onClick={addLine}
              className="mt-1.5 flex items-center gap-1.5 text-[13px] text-prominent-purple-700 hover:bg-prominent-purple-50 rounded-lg px-2 py-1"
            >
              <Plus className="w-4 h-4" /> Add line
            </button>
          </div>
        )}

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
      </form>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      {/* A deliberately unlabelled field still reserves the label's line —
          the Payee type select has none (the Payee box beside it labels the
          pair), and without this it rides up out of its row. */}
      <span className="block text-xs font-medium text-gray-600 mb-1">{label || '\u00A0'}</span>
      {children}
    </label>
  )
}
