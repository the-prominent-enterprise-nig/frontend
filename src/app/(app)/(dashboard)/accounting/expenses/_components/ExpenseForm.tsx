'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Info, Loader2, Plus, Trash2, Upload } from 'lucide-react'
import {
  Expenses,
  APBillSuppliers,
  APBills,
  ARInvoices,
  AccountMappings,
  BankAccounts,
  type BusinessExpense,
  type APBillSupplierOption,
  type APBill,
  type ARInvoice,
  type AccountMapping,
  type PayeeType,
  type ClearedType,
  type BankAccount,
  type SpecialAccountOption,
  type ExpenseVehicleOption,
  type ExpenseAgentOption,
  type ExpenseAgentSale,
  vehicleLabel,
  fmtMoney,
} from '@/src/libs/data/AccountingV2Data'
import { getAccountOptions, type Account } from '@/src/libs/data/AccountingData'
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
import ExpenseAttachmentsPanel, { uploadStagedExpenseAttachments } from './ExpenseAttachmentsPanel'
import { showToast } from '@/src/components/ui/toast'
import { importSpreadsheetLines, nameKeys, type ImportResult } from './importSpreadsheetLines'
import { SpecialAccountPicker } from './SpecialAccountPicker'
import { downloadCsv } from '@/src/libs/format/csv-export'
import { SearchCombobox, type SearchComboboxOption } from '@/src/components/ui/SearchCombobox'
import { useEwtCodes } from '@/src/hooks/useEwtCodes'
import { isCapexAccount } from '@/src/libs/tax/input-vat'
import {
  ewtOptionLabel,
  ewtShortLabel,
  ewtSelectOptions,
  type EwtRateFor,
} from '@/src/libs/tax/ewt'

// Ties the sticky header's Save to the <form> further down, which it sits
// outside of.
const FORM_ID = 'expense-form'

const PAYEE_OPTIONS: { value: PayeeType; label: string }[] = [
  { value: 'CUSTOMER', label: 'Customer' },
  { value: 'SUPPLIER', label: 'Supplier' },
  { value: 'EMPLOYEE', label: 'Employee' },
  { value: 'AGENT', label: 'Sales Agent' },
  { value: 'OTHER', label: 'Other' },
]

/** What a Vehicle Repairs and Maintenance line was for. The client's rule is
 * simply "dropdown" and gave no list, so this is the set their own mockup used
 * plus the usual remaining jobs; anything else goes under Others with the
 * detail typed into Service detail / remarks. */
const REPAIR_SERVICE_TYPES = [
  'Oil Change',
  'Tires',
  'Battery',
  'Brakes',
  'Tune-up',
  'Body Work',
  'Others',
]
const REPAIR_SERVICE_OPTIONS = [
  { value: '', label: '— Select —' },
  ...REPAIR_SERVICE_TYPES.map((t) => ({ value: t, label: t })),
]

/** Which extra fields a line's account asks for — Account.expenseKind. */
type ExpenseKind = NonNullable<Account['expenseKind']>

const CLEARED_OPTIONS: { value: ClearedType; label: string }[] = [
  { value: 'SAME_DATE', label: 'On the same date' },
  { value: 'LATER_DATE', label: 'On a later date' },
]

// VAT, NON_VAT, EXEMPT — mirrors the backend's free-text taxCode column.
// "Input VAT" is the label, not the stored value: on a purchase, VAT paid is
// input VAT (a claimable asset, account 1-01-370) — the reference tool names
// the code that way and so do we now, but the column keeps its 'VAT' value so
// existing rows stay valid. Its counterpart, Output VAT, is a sales-side
// liability and is deliberately absent — it can never apply to an expense.
/** Mirrors the backend's FLAT_VAT_RATE_PERCENT — the single rate left after
 * the configurable TaxRate table was removed. */
const VAT_RATE_PERCENT = 12

/** Scenario 69 Part G — a capital purchase: the Input VAT is claimed like any
 * other, but the line is tagged to the project or asset it is for, and its
 * account is a property / equipment one. */
const CAPEX_CODE = 'VAT-IN-CAPEX'

const TAX_CODE_OPTIONS = [
  { value: 'VAT', label: 'Input VAT' },
  { value: CAPEX_CODE, label: 'Capital goods (Input VAT)' },
  { value: 'NON_VAT', label: 'Non-VAT' },
  { value: 'EXEMPT', label: 'Exempt' },
]

/** The code a normal VATable purchase carries. */
const TAXABLE_CODE = 'VAT'

/** The codes that carry a claimable tax amount — everything else is, by
 * definition, a line with no VAT on it. */
const isTaxable = (code: string): boolean => code === TAXABLE_CODE || code === CAPEX_CODE

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
/** The one Category worth recording today — it marks an entry as a payroll run
 * (Payee → Other, ticked as "Payroll"). It changes no fields: the columns are driven by
 * the account on each line, not by the header. The backend also knows UTILITIES,
 * SALARIES_WAGES and SPECIAL_ACCOUNTS, left out deliberately — the first two only ever
 * prefilled a default account the Account picker sets directly, and the last needs a
 * specialAccountType this screen has no picker for. */
const PAYROLL_CATEGORY = 'PAYROLL'

/** Legacy and API-side spellings of the tax codes, mapped onto the values
 * this dropdown offers so a reopened record shows the treatment it was
 * saved with rather than an empty Select. */
const TAX_CODE_ALIASES: Record<string, string> = {
  INPUT_VAT: TAXABLE_CODE,
  NON_TAXABLE: 'NON_VAT',
  // The tax code master's own names for the same treatments.
  'VAT-IN-12': TAXABLE_CODE,
  'VAT-IN-NONVAT': 'NON_VAT',
  'VAT-IN-OOS': 'NON_VAT',
  'VAT-IN-EXEMPT': 'EXEMPT',
}
function taxCodeFor(stored?: string | null): string {
  if (!stored) return 'NON_VAT'
  return TAX_CODE_ALIASES[stored.toUpperCase()] ?? stored
}

/** The Tax Code a NEW line starts on. A purchase — a Supplier's, or an Other
 * payee that is not a payroll run — is almost always VATable, so it starts on
 * Input VAT instead of making the clerk switch it on for every line (it used to
 * start on Non-VAT). Everything else has no input VAT to claim and starts
 * Non-VAT: a customer refund, an employee reimbursement, an agent's commission,
 * and above all payroll, where VAT on a salary would post to the books.
 * A reopened draft keeps whatever it was saved with (see taxCodeFor). */
function defaultTaxCodeFor(payeeType: PayeeType | '', otherCategory: string): string {
  const isPurchase =
    payeeType === 'SUPPLIER' || (payeeType === 'OTHER' && otherCategory !== PAYROLL_CATEGORY)
  return isPurchase ? TAXABLE_CODE : 'NON_VAT'
}

const round2 = (n: number): number => Math.round(n * 100) / 100

/** Input VAT contained in the typed Amount.
 *
 * An Input VAT line is quoted VAT-inclusive: the supplier's invoice total is
 * what the clerk has in front of them and what actually leaves the bank, so
 * that is what the Amount box takes, and the API takes it as typed. The 12%
 * inside it is the 12/112 fraction of that amount, to the centavo — exactly
 * the figure the server derives (computeExpenseTaxAmount), so what is shown
 * here is what posts. Every other tax code carries no VAT. A deduction
 * (negative amount) is not a purchase and never carries input VAT. */
function vatFor(line: { taxCode: string; amount: string }): number {
  const amount = Number(line.amount) || 0
  if (!isTaxable(line.taxCode) || amount < 0) return 0
  return round2(amount * (VAT_RATE_PERCENT / (100 + VAT_RATE_PERCENT)))
}

/** What the typed Amount is worth net of VAT — what posts to the expense
 * account, and what a withholding tax is figured on. */
function netFor(line: { taxCode: string; amount: string }): number {
  const amount = Number(line.amount) || 0
  return round2(amount - vatFor(line))
}

/** What a line is withheld at its EWT code (Scenario 69 Part E): the code's
 * rate on the amount net of VAT — the figure the server derives and posts to
 * Withholding Tax Payable. The server rounds the same way, from the same rate;
 * only the rate (read off the tax code master by useEwtCodes) can differ, and
 * only until the list loads. A deduction is never withheld. */
function withholdingFor(
  line: { taxCode: string; amount: string; withholdingTaxCode: string },
  rateFor: EwtRateFor
): number {
  const amount = Number(line.amount) || 0
  if (!line.withholdingTaxCode || amount <= 0) return 0
  return round2(netFor(line) * rateFor(line.withholdingTaxCode))
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
  /** The project or asset a capital purchase (VAT-IN-CAPEX) is for. */
  projectAssetRef: string
  /** The EWT tax code this line is withheld at ('' = not withheld). The amount
   * withheld is derived (withholdingFor), never typed. */
  withholdingTaxCode: string
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
  // Fuel / Vehicle Repair lines (Account.expenseKind) — the vehicle from the
  // fleet roster, litres, the kind of job and a remark.
  vehicleId: string
  /** The plate as saved, so an edit still names a vehicle the roster list no
   * longer offers (deactivated, another branch's). */
  vehicleLabel: string
  liters: string
  repairServiceType: string
  serviceDetail: string
  // Commission lines — the sale being released, and whose it is (the line's Sales
  // Agent: picked, or filled in from the sale; an entry paid to a Sales Agent uses
  // that agent for every line instead).
  posTransactionId: string
  saleLabel: string
  saleAgentId: string
}
/** What a line stops carrying once its account moves to a different kind. */
const NO_KIND_FIELDS = {
  vehicleId: '',
  vehicleLabel: '',
  liters: '',
  repairServiceType: '',
  serviceDetail: '',
  posTransactionId: '',
  saleLabel: '',
  saleAgentId: '',
}
function emptyLine(taxCode: string = 'NON_VAT'): LineState {
  return {
    categoryAccountId: '',
    payee: '',
    division: '',
    collectFromId: '',
    collectFromLabel: '',
    description: '',
    amount: '',
    taxCode,
    projectAssetRef: '',
    withholdingTaxCode: '',
    itemId: '',
    itemLabel: '',
    qty: '',
    unitPrice: '',
    apBillId: '',
    apBillLabel: '',
    ...NO_KIND_FIELDS,
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
    getAccountOptions().then((r) => {
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
        // The client's chart has headers that aren't "-000" (1-01-040,
        // 2-01-100…); the seed marks every one in its description.
        const isHeader =
          (a.number ?? '').endsWith('-000') || (a.description ?? '').startsWith('Header account')
        return !isHeader && type !== 'EQUITY'
      })
      setPostableAccounts(postable)
      // A Supplier line can be a real inventory purchase (an Asset, not an
      // Expense) — "1-01-2*" is the Inventory account family (Inventory
      // itself, 1-01-200, plus its Appliances/Furniture/Aircon/IT Products
      // children), the only Asset accounts a Supplier expense line should
      // ever offer. Matched by number prefix since the frontend Account
      // type doesn't carry the backend's `category` enum.
      setInventoryAccounts(list.filter((a) => (a.number ?? '').startsWith('1-01-2')))
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

/** A numbered section heading — ① HEADER INFORMATION — as the client's form draws it. */
function SectionTitle({
  n,
  title,
  suffix,
  hint,
  right,
}: {
  n: number
  title: string
  suffix?: string
  hint?: string
  right?: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2.5 text-[14px] font-bold uppercase tracking-wide text-prominent-purple-700">
          <span
            aria-hidden
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-prominent-purple-800 text-[13px] font-bold text-white"
          >
            {n}
          </span>
          {title}
          {suffix && (
            <span className="text-[13px] font-medium normal-case tracking-normal text-zinc-500">
              {suffix}
            </span>
          )}
        </h2>
        {right}
      </div>
      {hint && <p className="ml-[38px] mt-0.5 text-[13px] text-zinc-500">{hint}</p>}
    </div>
  )
}

/** One field of a line, its label above it. A line's fields share one row, every one the same
 * width (see lineGridStyle). Not a <label>: some hold several controls (a tax code and its
 * VAT read-out), and a click on the read-out must not open the dropdown. */
function LineField({
  label,
  full,
  children,
}: {
  label: string
  /** The whole wording, as the tooltip, when `label` is shortened to fit the box. */
  full?: string
  children: React.ReactNode
}) {
  return (
    <div className="min-w-0">
      <span className="mb-1 block truncate text-xs font-medium text-gray-600" title={full}>
        {label}
      </span>
      {children}
    </div>
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
  // Only used while creating — an attachment needs the expense's id, which
  // doesn't exist yet. The panel holds the picked files here and submit
  // uploads them once the expense has been saved.
  const [stagedAttachments, setStagedAttachments] = useState<File[]>([])
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
    // "Paid from (Bank/Cash)". An older draft kept its bank on its payment row.
    sourceOfFundId:
      initial?.sourceOfFundId ??
      initial?.payments?.find((x) => x.bankAccountId)?.bankAccountId ??
      '',
    customerId: initial?.customerId ?? '',
    customerLabel: initial?.customer?.name ?? '',
    arInvoiceId: initial?.arInvoiceId ?? '',
    salesInvoiceNumber: initial?.salesInvoiceNumber ?? '',
    employeeId: initial?.employeeId ?? '',
    employeeLabel: initial?.employee
      ? [initial.employee.firstName, initial.employee.lastName].filter(Boolean).join(' ')
      : '',
    agentId: initial?.agentId ?? '',
    payee: initial?.payee ?? '',
    otherCategory: initial?.otherCategory ?? '',
    description: initial?.description ?? '',
    notes: initial?.notes ?? '',
  })
  // One payment, always: the whole total less any withholding, paid from the fund
  // chosen at "Paid from (Bank/Cash)". Only its Reference Number is typed — the
  // method, the amount and splitting across several are gone, as on the AP voucher.
  const [payments, setPayments] = useState<PaymentState[]>([
    { ...emptyPayment(), reference: initial?.payments?.[0]?.reference ?? '' },
  ])
  const [lines, setLines] = useState<LineState[]>(
    initial?.lines && initial.lines.length > 0
      ? initial.lines.map((l) => ({
          categoryAccountId: l.categoryAccountId ?? '',
          payee: l.payee || (l.employee ? `${l.employee.firstName} ${l.employee.lastName}` : ''),
          division: divisionValueFor(l),
          collectFromId: (l as any).customerId ?? '',
          collectFromLabel: (l as any).customer?.name ?? '',
          description: l.description ?? '',
          // Stored VAT-inclusive, exactly as typed (the API splits the VAT out
          // itself), so it reopens as it was entered. It used to add the tax
          // back on, which was right while the amount was stored net and
          // inflated every reopened Input VAT line once it stopped being.
          amount: String(l.amount ?? 0),
          taxCode: taxCodeFor(l.taxCode),
          projectAssetRef: l.projectAssetRef ?? '',
          withholdingTaxCode: l.withholdingTaxCode ?? '',
          itemId: l.itemId ?? '',
          itemLabel: '',
          qty: l.qty ? String(l.qty) : '',
          unitPrice: l.unitPrice ? String(l.unitPrice) : '',
          // No joined bill number to show yet (apBillId has no relation,
          // same as itemId) — the mount effect below re-resolves it.
          apBillId: l.apBillId ?? '',
          apBillLabel: '',
          vehicleId: l.vehicleId ?? '',
          vehicleLabel: l.vehicle ? vehicleLabel(l.vehicle) : '',
          liters: l.liters != null ? String(l.liters) : '',
          repairServiceType: l.repairServiceType ?? '',
          serviceDetail: l.serviceDetail ?? '',
          posTransactionId: l.posTransactionId ?? '',
          saleLabel: l.posTransaction
            ? (l.posTransaction.salesInvoiceNumber ?? l.posTransaction.transactionNumber)
            : '',
          saleAgentId: l.posTransaction?.sellingAgent?.id ?? '',
        }))
      : [emptyLine()]
  )
  const [siCandidates, setSiCandidates] = useState<Record<number, APBill[]>>({})
  // Sales Invoice (ARInvoice) suggestions for the header field below —
  // scoped to the header's customer. A resolver effect re-runs whenever the
  // customer changes, and backfills the display text when the form already
  // holds a linked arInvoiceId (e.g. an edit-mode draft loading) — same "no
  // joined label yet" gap apBillId has, for the same cross-module-id reason.
  const [arInvoiceCandidates, setArInvoiceCandidates] = useState<ARInvoice[]>([])
  useEffect(() => {
    const customerId = form.customerId
    if (!customerId) {
      setArInvoiceCandidates([])
      return
    }
    ARInvoices.list({ customerId }).then((res) => {
      const candidates = res.data?.items ?? []
      setArInvoiceCandidates(candidates)
      setForm((f) => {
        if (f.customerId !== customerId || !f.arInvoiceId || f.salesInvoiceNumber) return f
        const picked = candidates.find((c) => c.id === f.arInvoiceId)
        return picked ? { ...f, salesInvoiceNumber: picked.invoiceNumber } : f
      })
    })
  }, [form.customerId])
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
          // A payroll sheet: no VAT on salaries, whatever a new line starts on.
          ...emptyLine('NON_VAT'),
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
  // The Account picker offers the full Chart of Accounts for every payee
  // type — postableAccounts already covers assets/liabilities/expense/income
  // (headers and Equity stay excluded, see the fetch effect above), unioned
  // with inventoryAccounts since that set also carries the Inventory header
  // row (1-01-200) itself, which the "-000 = header" heuristic would
  // otherwise drop.
  const accountCategoryOptions = useMemo(() => {
    const merged = [...postableAccounts]
    const seen = new Set(merged.map((a) => a.id))
    for (const a of inventoryAccounts) {
      if (!seen.has(a.id)) {
        merged.push(a)
        seen.add(a.id)
      }
    }
    return accountsToCategoryOptions(merged)
  }, [postableAccounts, inventoryAccounts])
  // Scenario 69 Part G — a capital purchase posts to a property / equipment
  // account, so a capital line offers only those.
  const capexAccountOptions = useMemo(
    () => accountsToCategoryOptions(postableAccounts.filter(isCapexAccount)),
    [postableAccounts]
  )
  const capexAccountIds = useMemo(
    () => new Set(capexAccountOptions.map((o) => o.id)),
    [capexAccountOptions]
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
    form.payeeType === 'AGENT' ||
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
  // Fuel, Vehicle Repairs and Commission lines carry extra fields, and which
  // lines is decided by the account each one posts to (Account.expenseKind) —
  // not by a separate screen per kind of expense. A mixed voucher (fuel plus a
  // toll) just has detail rows on the lines that need them.
  const expenseKindByAccountId = useMemo(
    () =>
      new Map(
        postableAccounts
          .filter((a) => a.expenseKind)
          .map((a) => [a.id, a.expenseKind as ExpenseKind] as const)
      ),
    [postableAccounts]
  )
  /** The extra fields a line posting to this account carries. A payroll run is
   * left alone — its sheet maps lines onto whatever accounts it names. A
   * commission line is one whoever the payee is: it names the sale it releases. */
  const kindOfAccount = (accountId: string): ExpenseKind | null => {
    const kind = expenseKindByAccountId.get(accountId) ?? null
    if (!kind || isPayrollCategory) return null
    return kind
  }
  /** The Special Account column (Payee → Other) is for lines that carry a named
   * balance. A Fuel / Vehicle Repair / Commission line never does, so when every
   * line on the entry is one of those the column is dropped altogether — header
   * included. One ordinary (or still blank) line brings it back for the table. */
  const showSpecialColumn = isOtherMode && lines.some((l) => !kindOfAccount(l.categoryAccountId))
  // The fleet roster and the agent master, behind the expense permission (the
  // routes they wrap need inventory / CRM permissions an accountant lacks).
  const [vehicles, setVehicles] = useState<ExpenseVehicleOption[]>([])
  const [agents, setAgents] = useState<ExpenseAgentOption[]>([])
  useEffect(() => {
    Expenses.vehicles().then((r) => setVehicles(r.data ?? []))
    Expenses.agents().then((r) => setAgents(r.data ?? []))
  }, [])
  const agentOptions = useMemo(() => {
    const opts = agents.map((a) => ({ id: a.id, name: a.name, depth: 0 }))
    // An agent since deactivated is still the payee of the entry being reopened.
    if (initial?.agent && !opts.some((o) => o.id === initial.agent!.id)) {
      opts.push({ id: initial.agent.id, name: initial.agent.name, depth: 0 })
    }
    return opts
  }, [agents, initial])
  const vehicleOptions = useMemo(() => {
    // `<plate number> - <vehicle>`. The roster also lists a driver, but a line is
    // not tied to one — showing it beside a plate implied it was. The type
    // (category + tag) is what keeps a plate the roster lists twice apart.
    //
    // Rows that read identically (the roster has exact duplicates, e.g. the same
    // plate entered twice as a Collector) are offered once: nothing on screen
    // could tell the two apart, so a second copy is only a way to pick wrong.
    const seen = new Set<string>()
    return vehicles.flatMap((v) => {
      const name = vehicleLabel(v)
      if (seen.has(name)) return []
      seen.add(name)
      return [{ id: v.id, name, depth: 0 }]
    })
  }, [vehicles])
  // A saved line may point at the other copy of a duplicate — keep its label shown.
  const vehicleOptionsFor = (line: LineState) =>
    line.vehicleId && !vehicleOptions.some((o) => o.id === line.vehicleId)
      ? [...vehicleOptions, { id: line.vehicleId, name: line.vehicleLabel || 'Vehicle', depth: 0 }]
      : vehicleOptions
  // Scenario 69 Part E — a purchase can be withheld at an EWT code: a
  // Supplier's, or a free-text Other payee's (a lessor who is not a supplier).
  // A customer refund or an employee reimbursement is not a purchase, and a
  // payroll run is compensation, which an EWT code does not cover.
  const ewt = useEwtCodes()
  const canWithhold = isItemMode || (isOtherMode && !isPayrollCategory)
  /** A line can carry a code unless it is a deduction (a negative amount) or an advance /
   * loan line — neither is a purchase, and the server refuses a code on them. An amount not
   * typed yet does not count against it: the amount is required, so the code can be picked
   * first. */
  const lineCanWithhold = (l: LineState): boolean =>
    canWithhold &&
    !((Number(l.amount) || 0) < 0) &&
    !(isOtherMode && specialAccountControlIds.has(l.categoryAccountId))
  /** What a line is withheld at, as the server will see it: nothing when the
   * line cannot carry a code, whatever its state still holds. */
  const withheldFor = (l: LineState): number =>
    lineCanWithhold(l) ? withholdingFor(l, ewt.rateFor) : 0
  // Which of the kind-specific columns are showing. Table-wide, as the client's form
  // draws it: a column is there when any line needs it and is empty on the lines that
  // don't (a Plate Number box on a Toll line).
  const lineKinds = lines.map((l) => kindOfAccount(l.categoryAccountId))
  const showPlateCol = lineKinds.some((k) => k === 'FUEL' || k === 'VEHICLE_REPAIR')
  const showLitersCol = lineKinds.includes('FUEL')
  const showRepairCols = lineKinds.includes('VEHICLE_REPAIR')
  const showCommissionCols = lineKinds.includes('AGENT_COMMISSION')
  /** The chip under Save naming the kind of expense this is. */
  const expenseChip = showCommissionCols
    ? 'Sales Commission Expense'
    : showRepairCols
      ? 'Repair & Maintenance Expense'
      : showLitersCol || showPlateCol
        ? 'Fuel Expense'
        : null
  // A line's fields sit on one row, all the same width. The columns are as many as the
  // fullest line on the entry has fields, so every line shares one grid (a Fuel line leaves
  // the right end empty rather than stretching its boxes) — and if the page is too narrow
  // for that, they wrap at a 112px floor instead of squeezing.
  const lineFieldCount = (l: LineState) => {
    const k = kindOfAccount(l.categoryAccountId)
    return (
      (isItemMode ? 2 : 0) + // Item, SI
      1 + // Expense Account
      (showSpecialColumn && !k ? 1 : 0) + // Special Account
      (isItemMode ? 2 : 1) + // Qty + Unit Price, or Description
      (k === 'AGENT_COMMISSION' ? 2 : 0) + // Sales Invoice No., Sales Agent
      (k === 'FUEL' ? 2 : 0) + // Plate, Liters
      (k === 'VEHICLE_REPAIR' ? 3 : 0) + // Plate, Repair/Service Type, Service Detail
      3 + // Division, Tax Code, Amount
      (canWithhold ? 1 : 0) // Withholding
    )
  }
  const lineCols = Math.max(1, ...lines.map(lineFieldCount))
  const lineGridStyle = {
    gridTemplateColumns: `repeat(auto-fill, minmax(max(112px, calc((100% - ${(lineCols - 1) * 12}px) / ${lineCols} - 0.5px)), 1fr))`,
  }
  // Deductions larger than what the person still owes. Advisory only — the
  // balance stops at zero and the entry still records — but a payroll
  // sheet deducting more than is owed is far likelier a mis-key than a
  // refund, and the Special Accounts register is where it would otherwise
  // go unseen. Balances come from that same register, so the figure shown
  // here is the one on the Special Accounts page.
  const [balancesByAccount, setBalancesByAccount] = useState<
    Record<string, SpecialAccountOption[]>
  >({})
  const deductionAccountIds = useMemo(
    () =>
      [
        ...new Set(
          lines
            .filter(
              (l) =>
                Number(l.amount) < 0 &&
                l.payee.trim() &&
                specialAccountControlIds.has(l.categoryAccountId)
            )
            .map((l) => l.categoryAccountId)
        ),
      ].sort(),
    [lines, specialAccountControlIds]
  )
  const deductionAccountKey = deductionAccountIds.join(',')
  useEffect(() => {
    if (!isOtherMode || !deductionAccountKey) return
    let cancelled = false
    const t = setTimeout(async () => {
      const entries = await Promise.all(
        deductionAccountKey.split(',').map(async (accountId) => {
          const res = await Expenses.specialAccountOptions({ accountId }).catch(() => null)
          return [accountId, res?.data ?? []] as const
        })
      )
      if (!cancelled) setBalancesByAccount(Object.fromEntries(entries))
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [isOtherMode, deductionAccountKey])
  const overDeductions = useMemo(() => {
    if (!isOtherMode) return []
    const groups = new Map<string, { name: string; accountId: string; total: number }>()
    for (const l of lines) {
      const amount = Number(l.amount)
      const name = l.payee.trim()
      if (!(amount < 0) || !name || !specialAccountControlIds.has(l.categoryAccountId)) continue
      // Two lines for one person add up before they are compared with what
      // they owe — each alone might fit.
      const key = `${l.categoryAccountId}::${nameKeys(name)[0] ?? name}`
      const g = groups.get(key) ?? { name, accountId: l.categoryAccountId, total: 0 }
      g.total += -amount
      groups.set(key, g)
    }
    const out: { name: string; deducting: number; balance: number }[] = []
    for (const g of groups.values()) {
      const rows = balancesByAccount[g.accountId]
      // Until the balances load there is nothing honest to compare with.
      if (!rows) continue
      const keys = new Set(nameKeys(g.name))
      const row = rows.find(
        (r) =>
          nameKeys(r.name).some((k) => keys.has(k)) ||
          (r.employee && nameKeys(r.employee.name).some((k) => keys.has(k)))
      )
      const balance = Math.max(row?.balance ?? 0, 0)
      if (g.total > balance + 0.005) {
        out.push({ name: row?.name ?? g.name, deducting: g.total, balance })
      }
    }
    return out
  }, [isOtherMode, lines, specialAccountControlIds, balancesByAccount])
  // Supplier line-category default (Settings → Account Mapping) — used when
  // a picked Item has no inventory account of its own, or no Item is
  // picked yet at all.
  const supplierDefaultAccountId = mappings.find(
    (m) => m.key === 'EXPENSE_SUPPLIER_INVENTORY'
  )?.accountId

  const subtotal = lines.reduce((sum, l) => sum + netFor(l), 0)
  const vatTotal = lines.reduce((sum, l) => sum + vatFor(l), 0)
  // Equals what was typed into the Amount boxes — on an Input VAT line the
  // VAT is taken out of that figure, not added to it.
  const total = subtotal + vatTotal
  // What was withheld from the payee goes to the BIR, not out of the bank:
  // the payment rows below total the rest.
  const withholdingTotal = round2(lines.reduce((sum, l) => sum + withheldFor(l), 0))
  const netPayable = round2(total - withholdingTotal)
  // A cash advance being liquidated: every deduction takes an advance back off
  // a Special Account, and the positive lines are the receipts it was spent
  // on. Mirrors ExpensesService.isAdvanceLiquidation — the one entry that may
  // net to zero (spent exactly) or below (the change is handed back).
  const isAdvanceLiquidation =
    isOtherMode &&
    !isPayrollCategory &&
    lines.some((l) => Number(l.amount) < 0) &&
    lines.every((l) => Number(l.amount) > 0 || specialAccountControlIds.has(l.categoryAccountId))
  const advanceTakenBack = isAdvanceLiquidation
    ? round2(lines.reduce((sum, l) => sum + Math.min(Number(l.amount) || 0, 0), 0))
    : 0

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
        ...emptyLine(defaultTaxCodeFor(form.payeeType, form.otherCategory)),
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

  const setPayment = (index: number, patch: Partial<PaymentState>) =>
    setPayments((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)))

  // Lets the sticky header's Save submit a form it sits outside of.
  const formRef = useRef<HTMLFormElement>(null)
  // Which header button submitted: both go through the same <form> submit, so
  // the choice rides in a ref rather than state (no re-render between the
  // click and requestSubmit reading it).
  const submitModeRef = useRef<'draft' | 'record'>('draft')
  const submitAs = (mode: 'draft' | 'record') => {
    submitModeRef.current = mode
    formRef.current?.requestSubmit()
  }

  const validate = (): string | null => {
    if (form.clearedType === 'LATER_DATE' && !form.clearedDate)
      return 'Pick the date this payment is expected to clear.'
    if (!form.sourceOfFundId) return 'Pick where this is paid from (Bank/Cash).'
    if (!form.payeeType)
      return 'Choose who this is for (Customer, Supplier, Employee, Sales Agent, or Other).'
    if (form.payeeType === 'CUSTOMER' && !form.customerId) return 'Pick a customer.'
    if (form.payeeType === 'EMPLOYEE' && !form.employeeId) return 'Pick an employee.'
    if (form.payeeType === 'AGENT' && !form.agentId) return 'Pick the sales agent.'
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
      // The client's form marks Division required on every line — except a payroll
      // run, whose sheet names a department on each row and carries deductions with none.
      if (!isPayrollCategory && !l.division) return 'Every line needs a Division.'
      if (l.taxCode === CAPEX_CODE && !l.projectAssetRef.trim())
        return 'A capital purchase needs the project or asset it is for.'
      const kind = kindOfAccount(l.categoryAccountId)
      if ((kind === 'FUEL' || kind === 'VEHICLE_REPAIR') && !l.vehicleId)
        return 'Pick the plate number on every fuel and vehicle-repair line.'
      if (kind === 'VEHICLE_REPAIR' && !l.repairServiceType)
        return 'Pick the Repair/Service Type on every vehicle-repair line.'
      if (kind === 'FUEL' && l.liters !== '' && !(Number(l.liters) >= 0))
        return 'Liters cannot be negative.'
      if (kind === 'AGENT_COMMISSION' && !l.posTransactionId)
        return 'Pick the Sales Invoice No. on every commission line.'
    }
    const releasedSales = lines
      .filter((l) => kindOfAccount(l.categoryAccountId) === 'AGENT_COMMISSION')
      .map((l) => l.posTransactionId)
      .filter(Boolean)
    if (new Set(releasedSales).size !== releasedSales.length)
      return "The same sales invoice is on two lines — a sale's commission is released once."
    // The entry as a whole has to be money going out: record() credits cash
    // for the total, and deductions exceeding what they deduct from is a
    // mis-key. The server rejects it too. Unreachable off payroll, where
    // every line is already required to be positive.
    if (isAdvanceLiquidation) {
      // The server refuses this too; say who and by how much before it does.
      const over = overDeductions[0]
      if (over)
        return `${over.name} only owes ${fmtMoney(over.balance)} — a liquidation can't take back more than that.`
    } else if (total <= 0) {
      return 'Deductions cannot meet or exceed the amounts they deduct from.'
    }
    return null
  }

  const resetLinesForPayeeChange = (nextPayeeType: PayeeType | '') =>
    setLines([emptyLine(defaultTaxCodeFor(nextPayeeType, ''))])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const mode = submitModeRef.current
    submitModeRef.current = 'draft'
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
      notes: form.notes.trim() || undefined,
    }
    // One payment, posted to the Paid-from fund's own ledger: the whole total less
    // any withholding (what actually leaves the bank).
    payload.payments = [
      {
        paymentMethod: 'BANK_TRANSFER',
        bankAccountId: form.sourceOfFundId,
        reference: payments[0]?.reference || undefined,
        // A liquidation's change comes back into this fund — still a positive
        // row; the server books it as cash received. Zero when spent exactly.
        amount: Math.abs(round2(netPayable)),
      },
    ]
    // No voucherNumber here: the server issues it from the Paid-from fund's series when
    // the entry is saved (and re-issues it if the fund changes), so it is never typed.
    payload.sourceOfFundId = form.sourceOfFundId || undefined
    if (form.payeeType === 'CUSTOMER') {
      payload.customerId = form.customerId
      payload.arInvoiceId = form.arInvoiceId || undefined
      payload.salesInvoiceNumber = form.salesInvoiceNumber || undefined
    } else if (form.payeeType === 'EMPLOYEE') {
      payload.employeeId = form.employeeId
    } else if (form.payeeType === 'SUPPLIER') {
      payload.supplierId = form.supplierId || undefined
    } else if (form.payeeType === 'AGENT') {
      // The server keeps the agent's name as the payee.
      payload.agentId = form.agentId
    } else {
      // The payee's own name — "NIG EMPLOYEES" on the client's payroll
      // voucher, and what the printed voucher shows as the payee.
      payload.payee = form.payee || undefined
      payload.otherCategory = form.otherCategory || undefined
    }
    payload.lines = lines.map((l) => {
      const line: Record<string, unknown> = {
        // The API takes the VAT-inclusive amount and splits the 12% out
        // itself, so send exactly what was typed — the payments (also
        // VAT-inclusive) are checked against the sum of these.
        amount: Number(l.amount) || 0,
        description: l.description || undefined,
        taxCode: l.taxCode || undefined,
      }
      line.categoryAccountId = l.categoryAccountId
      if (l.taxCode === CAPEX_CODE) line.projectAssetRef = l.projectAssetRef.trim()
      // The code only — the server derives the amount from it, as it does the
      // VAT, so there is no figure here that could disagree with what posts.
      if (lineCanWithhold(l) && l.withholdingTaxCode) {
        line.withholdingTaxCode = l.withholdingTaxCode
      }
      // Special Account and the customer a deduction collects from
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
      }
      // Division is on every line, whoever the payee is.
      Object.assign(line, divisionIdsFor(l.division))
      // Which of these a line sends is its account's call — see kindOfAccount.
      const kind = kindOfAccount(l.categoryAccountId)
      if (kind === 'FUEL' || kind === 'VEHICLE_REPAIR') line.vehicleId = l.vehicleId
      if (kind === 'FUEL' && l.liters !== '') line.liters = Number(l.liters)
      if (kind === 'VEHICLE_REPAIR') {
        line.repairServiceType = l.repairServiceType
        if (l.serviceDetail.trim()) line.serviceDetail = l.serviceDetail.trim()
      }
      if (kind === 'AGENT_COMMISSION') line.posTransactionId = l.posTransactionId
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
    if (!res.success) {
      setSaving(false)
      setError(res.message || res.error || 'Save failed')
      return
    }
    // Receipts picked before the expense existed only have somewhere to
    // attach to now. Done before Record so they are kept even if posting
    // fails, and a failure here is reported but doesn't undo the save —
    // losing a recorded expense over a failed upload would be the worse of
    // the two outcomes, and the file can be re-attached from the expense.
    const savedId = (res.data as { id?: string } | undefined)?.id
    if (!initial && stagedAttachments.length > 0 && savedId) {
      const failed = await uploadStagedExpenseAttachments(savedId, stagedAttachments)
      if (failed > 0) {
        showToast({
          title: `${failed} attachment${failed === 1 ? '' : 's'} failed to upload`,
          description: 'The expense saved. Attach the file again from the expense itself.',
          status: 'error',
        })
      }
    }
    if (mode === 'record') {
      const saved = res.data as { id?: string } | undefined
      const rec = await Expenses.record(saved?.id ?? initial!.id)
      if (!rec.success) {
        setSaving(false)
        // The draft is saved; only posting failed. On a new form another
        // click would create a second expense, so point at the list instead.
        setError(
          `Saved as a draft, but recording failed: ${rec.message || rec.error || 'unknown error'}. Fix it from the expenses list; don't submit this form again.`
        )
        return
      }
    }
    setSaving(false)
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
          <div className="flex shrink-0 flex-col items-end gap-2 pt-1">
            <div className="flex items-center gap-2">
              <Link
                href="/accounting/expenses"
                className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
              >
                Cancel
              </Link>
              <button
                type="button"
                onClick={() => submitAs('draft')}
                disabled={saving}
                className="flex items-center gap-2 rounded-lg border border-prominent-purple-700 px-4 py-2 text-sm font-medium text-prominent-purple-700 hover:bg-prominent-purple-50 disabled:opacity-60"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {saving ? 'Saving...' : 'Save draft'}
              </button>
              <button
                type="button"
                onClick={() => submitAs('record')}
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800 disabled:opacity-60"
              >
                Record
              </button>
            </div>
            {expenseChip && (
              <span
                data-testid="expense-kind-chip"
                className="px-1 text-[13px] font-bold uppercase tracking-wide text-prominent-purple-800"
              >
                {expenseChip}
              </span>
            )}
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

      <form ref={formRef} id={FORM_ID} onSubmit={submit} className="mt-6 space-y-6">
        {/* ① Header Information — the client's field order: Date, Cleared, Paid from,
            Reference Number; then Payee and Description / Particulars. (The voucher number is
            issued on save.) */}
        <section>
          <SectionTitle n={1} title="Header Information" />
          <div className="mt-4 space-y-4">
            <div
              className={`grid gap-x-4 gap-y-4 ${
                form.clearedType === 'LATER_DATE'
                  ? 'grid-cols-2 lg:grid-cols-5'
                  : 'grid-cols-2 lg:grid-cols-4'
              }`}
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
              {/* Where the money comes from — the fund the payment posts to, and the series
                  the voucher number is issued from. It replaces the payment method, the
                  amount and the split rows. */}
              <Field
                label={
                  isAdvanceLiquidation && netPayable < 0
                    ? 'Change returned to (Bank/Cash) *'
                    : 'Paid from (Bank/Cash) *'
                }
              >
                <CategorySelect
                  compact
                  aria-label="Select source of fund"
                  noun="funds"
                  value={form.sourceOfFundId}
                  onChange={(id) => setForm({ ...form, sourceOfFundId: id ?? '' })}
                  options={bankAccountOptions}
                  placeholder="— Select —"
                />
              </Field>
              <Field label="Reference Number">
                <input
                  aria-label="Reference number"
                  value={payments[0]?.reference ?? ''}
                  onChange={(e) => setPayment(0, { reference: e.target.value })}
                  className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-4 lg:grid-cols-4">
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
                      arInvoiceId: '',
                      salesInvoiceNumber: '',
                      supplierId: '',
                      employeeId: '',
                      employeeLabel: '',
                      agentId: '',
                      payee: '',
                      otherCategory: '',
                    })
                    resetLinesForPayeeChange(value as PayeeType)
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
                  {/* Payroll is the only thing Category ever recorded, so it is a tick box: it marks
                    the entry as a payroll run (see PAYROLL_CATEGORY). */}
                  <div>
                    <span aria-hidden className="mb-1 block text-xs">
                      {'\u00A0'}
                    </span>
                    <label
                      className="flex h-[34px] items-center gap-2 text-[13px] text-zinc-700"
                      title="A payroll run — unlocks the spreadsheet import"
                    >
                      <input
                        type="checkbox"
                        aria-label="Payroll"
                        checked={form.otherCategory === PAYROLL_CATEGORY}
                        onChange={(e) => {
                          const payroll = e.target.checked
                          setForm({ ...form, otherCategory: payroll ? PAYROLL_CATEGORY : '' })
                          // Calling the entry a payroll run takes VAT off the lines already
                          // on it — they started on Input VAT while it was an ordinary purchase.
                          if (payroll)
                            setLines((prev) => prev.map((l) => ({ ...l, taxCode: 'NON_VAT' })))
                        }}
                        className="h-4 w-4 rounded border-zinc-300 accent-prominent-purple-700"
                      />
                      Payroll
                    </label>
                  </div>
                </>
              )}
              {form.payeeType === 'CUSTOMER' && (
                <>
                  <Field label="Customer *">
                    <CustomerPicker
                      compact
                      value={form.customerId}
                      selectedLabel={form.customerLabel}
                      onChange={(customerId, label) =>
                        // A customer switch invalidates the old Sales Invoice pick
                        // — it belonged to the previous customer's account, and
                        // the suggestion list is scoped by customer.
                        setForm({
                          ...form,
                          customerId,
                          customerLabel: label,
                          arInvoiceId: '',
                          salesInvoiceNumber: '',
                        })
                      }
                    />
                  </Field>
                  <Field label="Sales Invoice">
                    <input
                      list="ar-invoice-suggestions"
                      value={form.salesInvoiceNumber}
                      onChange={(e) => {
                        const text = e.target.value
                        const matched = arInvoiceCandidates.find(
                          (c) => c.invoiceNumber.toLowerCase() === text.trim().toLowerCase()
                        )
                        setForm({
                          ...form,
                          salesInvoiceNumber: text,
                          arInvoiceId: matched?.id ?? '',
                        })
                      }}
                      placeholder="Sales Invoice #"
                      className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                    />
                    <datalist id="ar-invoice-suggestions">
                      {arInvoiceCandidates.map((c) => (
                        <option key={c.id} value={c.invoiceNumber} />
                      ))}
                    </datalist>
                  </Field>
                </>
              )}
              {form.payeeType === 'EMPLOYEE' && (
                <>
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
                </>
              )}
              {form.payeeType === 'AGENT' && (
                <>
                  <Field label="Sales Agent *">
                    <CategorySelect
                      compact
                      aria-label="Select sales agent"
                      noun="agents"
                      value={form.agentId}
                      onChange={(id) => {
                        setForm({ ...form, agentId: id ?? '' })
                        // The sales already picked were this agent's, not the next one's.
                        setLines((prev) =>
                          prev.map((l) => ({ ...l, posTransactionId: '', saleLabel: '' }))
                        )
                      }}
                      options={agentOptions}
                      placeholder="— Select —"
                    />
                  </Field>
                </>
              )}
              {form.payeeType === 'SUPPLIER' && (
                <>
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
                </>
              )}
              {/* Issued by the system on save, so never typed — shown once there is one. */}
              {initial?.voucherNumber && (
                <Field label="Voucher #">
                  <input
                    aria-label="Voucher number"
                    readOnly
                    tabIndex={-1}
                    value={initial.voucherNumber}
                    className="w-full rounded-lg border border-zinc-100 bg-zinc-50 px-2.5 py-1.5 text-[13px] text-zinc-600 outline-none"
                  />
                </Field>
              )}
            </div>

            <Field label="Description / Particulars">
              <input
                aria-label="Description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
              />
            </Field>
          </div>
        </section>

        {/* Line items — Scenario 40 Part 6. Supplier is the only payee type
            that can be a real inventory purchase, so it's the only one that
            gets the Item/Qty/Unit Price columns; every other type just
            picks a Category and types a flat Amount. */}
        {/* ② Expense Details */}
        <section className="border-t border-zinc-200 pt-6">
          <SectionTitle
            n={2}
            title="Expense Details"
            hint={
              showCommissionCols
                ? 'Add one or more expense items. Use the “Sales Invoice No.” to select invoices assigned to the chosen Sales Agent.'
                : 'Add one or more expense items. Vehicle fields will appear automatically for vehicle-related accounts.'
            }
            right={
              hasOwnCategoryLines ? (
                <button
                  type="button"
                  onClick={addLine}
                  className="flex items-center gap-2 rounded-lg border border-prominent-purple-700 px-4 py-2 text-sm font-semibold text-prominent-purple-700 hover:bg-prominent-purple-50"
                >
                  <Plus className="h-4 w-4" /> Add Line
                </button>
              ) : undefined
            }
          />
          {!hasOwnCategoryLines && (
            <p className="mt-3 text-[13px] text-zinc-500">Choose the payee above first.</p>
          )}
          {hasOwnCategoryLines && (
            <div className="mt-4">
              <div className="divide-y divide-zinc-200">
                {lines.map((line, i) => {
                  const kind = kindOfAccount(line.categoryAccountId)
                  // Whose sales this commission line can release: the entry's agent when it
                  // is paid to one, else the line's own pick.
                  const lineAgentId = form.payeeType === 'AGENT' ? form.agentId : line.saleAgentId
                  // Sales already on another line of this entry — not offered again.
                  const otherSaleIds = lines
                    .filter((_, j) => j !== i)
                    .map((l) => l.posTransactionId)
                    .filter(Boolean)
                  return (
                    <div
                      key={i}
                      data-testid="expense-line"
                      data-kind={kind ?? ''}
                      className="py-5 first:pt-0 last:pb-0"
                    >
                      {lines.length > 1 && (
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                            Line {i + 1}
                          </span>
                          <button
                            type="button"
                            aria-label={`Remove line ${i + 1}`}
                            onClick={() => removeLine(i)}
                            className="rounded p-1 text-red-500 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                      <div className="grid gap-x-3 gap-y-3" style={lineGridStyle}>
                        {isItemMode && (
                          <>
                            <LineField label="Item">
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
                                    unitPrice: meta.costPrice
                                      ? String(meta.costPrice)
                                      : line.unitPrice,
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
                            </LineField>
                            <LineField label="SI">
                              <CategorySelect
                                compact
                                aria-label="Supplier Invoice"
                                noun="invoices"
                                value={line.apBillId}
                                onChange={(id) => {
                                  const bill = (siCandidates[i] ?? []).find((b) => b.id === id)
                                  setLine(
                                    i,
                                    bill ? billPatch(bill) : { apBillId: '', apBillLabel: '' }
                                  )
                                }}
                                options={(siCandidates[i] ?? []).map((b) => ({
                                  id: b.id,
                                  name: b.billNumber ?? '(no invoice #)',
                                  depth: 0,
                                }))}
                                placeholder="— None —"
                              />
                            </LineField>
                          </>
                        )}
                        <LineField label="Account (COA) *" full="Expense Account (COA) *">
                          <CategorySelect
                            compact
                            aria-label="Account"
                            noun="accounts"
                            // The number only — the name is the tooltip and is in the list.
                            displayValue={(o) => o.name.split(' — ')[0]}
                            value={line.categoryAccountId}
                            onChange={(id) => {
                              setLine(i, {
                                categoryAccountId: id ?? '',
                                // An advance or a loan is money lent, not a purchase — it
                                // never carries Input VAT, whatever the line started on.
                                ...(specialAccountControlIds.has(id ?? '')
                                  ? { taxCode: 'NON_VAT' }
                                  : {}),
                                // Moving to an account of a different kind drops what
                                // the old one collected — a plate means nothing on a
                                // commission line. Same kind keeps it.
                                ...(kindOfAccount(id ?? '') !== kind ? NO_KIND_FIELDS : {}),
                              })
                            }}
                            options={
                              line.taxCode === CAPEX_CODE
                                ? capexAccountOptions
                                : accountCategoryOptions
                            }
                            placeholder="— Select —"
                          />
                        </LineField>
                        {/* Which named balance the line belongs to, under whichever control
                          account the Account picker chose. Inert on an account that keeps no
                          such ledger. Not on a Fuel / Vehicle Repair / Commission line —
                          those accounts never keep one — and not at all unless some line
                          needs it. */}
                        {showSpecialColumn && !kind && (
                          <LineField label="Special Account">
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
                          </LineField>
                        )}
                        {/* What this kind of line needs, in the same row as the account — a
                          supplier's items (Qty, Unit Price), the vehicle and litres, what was done
                          to it, or, for a commission, the sale being released and whose it is. The
                          agent is the payee, so it fills itself: a voucher cannot pay one agent and
                          credit another. A line is two rows at most: this row, then Division /
                          Tax Code / Withholding / Amount. */}
                        {isItemMode && (
                          <>
                            <LineField label="Qty">
                              <input
                                type="number"
                                step="1"
                                min="0"
                                aria-label="Quantity"
                                value={line.qty}
                                onChange={(e) => setLine(i, { qty: e.target.value })}
                                className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                              />
                            </LineField>
                            <LineField label="Unit Price">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                aria-label="Unit price"
                                value={line.unitPrice}
                                onChange={(e) => setLine(i, { unitPrice: e.target.value })}
                                className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                              />
                            </LineField>
                          </>
                        )}
                        {kind === 'AGENT_COMMISSION' && (
                          <>
                            <LineField label="Sales Invoice No. *">
                              <SearchCombobox
                                key={`${i}-${line.posTransactionId}-${lineAgentId}`}
                                compact
                                value={line.posTransactionId}
                                initialLabel={line.saleLabel}
                                queryKey={`expense-commission-sales:${lineAgentId}:${otherSaleIds.join(',')}`}
                                placeholder="— Select —"
                                typeToSearchMessage={
                                  lineAgentId ? "Search this agent's sales…" : 'Search sales…'
                                }
                                emptyMessage="No unreleased sales found"
                                onChange={(id) => {
                                  if (!id) setLine(i, { posTransactionId: '', saleLabel: '' })
                                }}
                                onSelect={(option) => {
                                  const sale = option.meta as ExpenseAgentSale
                                  setLine(i, {
                                    posTransactionId: sale.id,
                                    saleLabel: sale.number,
                                    // Whose commission it is — the line's Sales Agent.
                                    ...(sale.agentId ? { saleAgentId: sale.agentId } : {}),
                                    // What the system accrued on the sale, when it did —
                                    // a starting point, still editable.
                                    ...(line.amount === '' && sale.commission != null
                                      ? { amount: String(sale.commission) }
                                      : {}),
                                    ...(line.description.trim() === ''
                                      ? { description: `Commission - ${sale.number}` }
                                      : {}),
                                  })
                                }}
                                search={async (query) => {
                                  const res = await Expenses.commissionSales({
                                    agentId: lineAgentId || undefined,
                                    search: query || undefined,
                                    excludeExpenseId: initial?.id,
                                  })
                                  return (res.data ?? [])
                                    .filter((x) => !x.releasedOn && !otherSaleIds.includes(x.id))
                                    .map((x) => ({
                                      id: x.id,
                                      primary: x.number,
                                      secondary: [
                                        // Which agent's it is, when the list is not already one
                                        // agent's.
                                        lineAgentId ? null : x.agentName,
                                        x.customerName,
                                        fmtMoney(x.subtotal),
                                      ]
                                        .filter(Boolean)
                                        .join(' · '),
                                      badge:
                                        x.commission != null
                                          ? `Commission ${fmtMoney(x.commission)}`
                                          : undefined,
                                      meta: x,
                                    }))
                                }}
                              />
                            </LineField>
                            <LineField label="Sales Agent *">
                              {form.payeeType === 'AGENT' ? (
                                // Paid to a Sales Agent: that agent, on every line.
                                <div
                                  aria-label="Sales agent"
                                  className="flex h-[34px] items-center truncate rounded-lg border border-zinc-100 bg-zinc-50 px-2.5 text-[13px] text-zinc-700"
                                >
                                  {agentOptions.find((o) => o.id === form.agentId)?.name ?? '—'}
                                </div>
                              ) : (
                                <CategorySelect
                                  compact
                                  aria-label="Line sales agent"
                                  noun="agents"
                                  value={line.saleAgentId || undefined}
                                  onChange={(id) =>
                                    // The sale picked was the previous agent's, not this one's.
                                    setLine(i, {
                                      saleAgentId: id ?? '',
                                      ...((id ?? '') !== line.saleAgentId
                                        ? { posTransactionId: '', saleLabel: '' }
                                        : {}),
                                    })
                                  }
                                  options={agentOptions}
                                  placeholder="— Select —"
                                />
                              )}
                            </LineField>
                          </>
                        )}
                        {(kind === 'FUEL' || kind === 'VEHICLE_REPAIR') && (
                          <LineField label="Plate Number *">
                            <CategorySelect
                              compact
                              aria-label="Plate number"
                              noun="vehicles"
                              value={line.vehicleId || undefined}
                              onChange={(id) =>
                                setLine(i, { vehicleId: id ?? '', vehicleLabel: '' })
                              }
                              options={vehicleOptionsFor(line)}
                              placeholder="— Select —"
                            />
                          </LineField>
                        )}
                        {kind === 'FUEL' && (
                          <LineField label="Liters (optional)">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              aria-label="Liters"
                              value={line.liters}
                              onChange={(e) => setLine(i, { liters: e.target.value })}
                              className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                            />
                          </LineField>
                        )}
                        {kind === 'VEHICLE_REPAIR' && (
                          <>
                            <LineField label="Service Type *" full="Repair/Service Type *">
                              <Select
                                compact
                                aria-label="Repair or service type"
                                value={line.repairServiceType}
                                onChange={(repairServiceType) => setLine(i, { repairServiceType })}
                                options={REPAIR_SERVICE_OPTIONS}
                              />
                            </LineField>
                            <LineField label="Service Detail" full="Service Detail / Remarks">
                              <input
                                aria-label="Service detail"
                                value={line.serviceDetail}
                                maxLength={255}
                                onChange={(e) => setLine(i, { serviceDetail: e.target.value })}
                                className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                              />
                            </LineField>
                          </>
                        )}
                        {!isItemMode && (
                          <LineField label="Description">
                            <input
                              aria-label="Line description"
                              value={line.description}
                              onChange={(e) => setLine(i, { description: e.target.value })}
                              className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                            />
                          </LineField>
                        )}
                        {/* One pick from the branches and departments list, on every line. */}
                        <LineField label={isPayrollCategory ? 'Division' : 'Division *'}>
                          <CategorySelect
                            compact
                            aria-label="Division"
                            noun="divisions"
                            value={line.division || undefined}
                            onChange={(division) => setLine(i, { division: division ?? '' })}
                            options={divisionChoices.map((d) => ({
                              id: d.value,
                              name: d.label,
                              depth: 0,
                            }))}
                            placeholder="— Select —"
                          />
                        </LineField>
                        {/* The Input VAT already inside the amount sits under the Tax Code, the
                          way the withholding does under its code. Only an Input VAT line has
                          any; the others have none by definition, so nothing is shown. */}
                        <LineField label="Tax Code *">
                          <div
                            data-testid="line-tax"
                            className="min-w-0"
                            title={
                              isTaxable(line.taxCode)
                                ? `The ${VAT_RATE_PERCENT}% Input VAT already inside the amount, split out on save`
                                : 'No VAT on this tax code'
                            }
                          >
                            <Select
                              compact
                              value={line.taxCode}
                              onChange={(taxCode) =>
                                setLine(i, {
                                  taxCode,
                                  // A capital line posts to a property / equipment
                                  // account: an account picked for something else
                                  // cannot stay.
                                  ...(taxCode === CAPEX_CODE &&
                                  !capexAccountIds.has(line.categoryAccountId)
                                    ? { categoryAccountId: '' }
                                    : {}),
                                })
                              }
                              options={TAX_CODE_OPTIONS}
                            />
                            {vatFor(line) > 0 && (
                              <p
                                aria-label="Tax amount"
                                className="mt-0.5 truncate px-1 text-[11px] text-zinc-500"
                              >
                                {fmtMoney(vatFor(line))} VAT
                              </p>
                            )}
                          </div>
                        </LineField>
                        {/* Scenario 69 Part E — which EWT code this line is withheld at. The
                          amount is worked out, never typed: the code's rate on the amount net
                          of VAT. */}
                        {canWithhold && (
                          <LineField label="Withholding">
                            <div
                              data-testid="line-withholding"
                              className="min-w-0"
                              title={
                                !lineCanWithhold(line)
                                  ? 'A deduction or an advance / loan line cannot be withheld'
                                  : (() => {
                                      const picked = ewt.options.find(
                                        (o) => o.code === line.withholdingTaxCode
                                      )
                                      return picked
                                        ? `${ewtOptionLabel(picked)} — on the amount net of VAT`
                                        : 'Withheld at this EWT code on the amount net of VAT'
                                    })()
                              }
                            >
                              <Select
                                compact
                                disabled={!lineCanWithhold(line)}
                                value={line.withholdingTaxCode}
                                onChange={(withholdingTaxCode) =>
                                  setLine(i, { withholdingTaxCode })
                                }
                                options={[
                                  { value: '', label: '— None —' },
                                  ...ewtSelectOptions(
                                    ewt.options,
                                    line.withholdingTaxCode,
                                    ewt.isLoading,
                                    ewtShortLabel
                                  ),
                                ]}
                              />
                              {withheldFor(line) > 0 && (
                                <p className="mt-0.5 truncate px-1 text-[11px] text-zinc-500">
                                  −{fmtMoney(withheldFor(line))} withheld
                                </p>
                              )}
                            </div>
                          </LineField>
                        )}
                        {/* Payee → Other alone can go negative — a payroll sheet's Credit column
                          (statutory withholding, an advance taken back out of pay), which needs
                          no min to stay typeable. Every other payee keeps its floor. */}
                        <LineField label="Amount *">
                          <input
                            required
                            type="number"
                            step="0.01"
                            min={isOtherMode ? undefined : '0.01'}
                            aria-label="Amount"
                            title={
                              isTaxable(line.taxCode)
                                ? `VAT-inclusive — the ${VAT_RATE_PERCENT}% Input VAT is split out of this amount`
                                : undefined
                            }
                            readOnly={isItemMode && !!line.itemId}
                            value={line.amount}
                            onChange={(e) => setLine(i, { amount: e.target.value })}
                            className={`w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500 ${
                              isItemMode && line.itemId ? 'bg-zinc-50 text-zinc-500' : ''
                            }`}
                          />
                        </LineField>
                      </div>
                      {/* Scenario 69 Part G — what a capital purchase is for. */}
                      {line.taxCode === CAPEX_CODE && (
                        <div
                          data-testid="line-project-asset"
                          className="mt-3 flex items-center gap-2"
                        >
                          <label className="text-[12px] font-medium text-zinc-600">
                            Project / asset
                          </label>
                          <input
                            aria-label="Project or asset"
                            value={line.projectAssetRef}
                            onChange={(e) => setLine(i, { projectAssetRef: e.target.value })}
                            placeholder="e.g. FA-0007, or the CIP / project reference"
                            maxLength={100}
                            className="w-full max-w-md rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                          />
                          <span className="text-[11px] text-zinc-500">
                            Post it to a property / equipment account.
                          </span>
                        </div>
                      )}
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
                            ['Advances to Employees and Officers', 'DELA CRUZ, JUAN', '', 2500],
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
                          {importResult.skippedEmptyRows} row(s) carried no amount — the
                          sheet&apos;s own header row, and any row whose debit and credit cancel
                          out.
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
                          No matching account for {importResult.unmatchedAccounts.join(', ')} —
                          those lines need an Account picked before saving.
                        </p>
                      )}
                      {importResult.ambiguousAccounts.length > 0 && (
                        <p className="mt-0.5 text-amber-700">
                          More than one account is named {importResult.ambiguousAccounts.join(', ')}{' '}
                          — those lines need the right Account picked before saving.
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

              {overDeductions.length > 0 && (
                <div
                  role="alert"
                  className={`mt-2 rounded-lg border px-3 py-2 text-[12px] ${
                    isAdvanceLiquidation
                      ? 'border-red-200 bg-red-50 text-red-800'
                      : 'border-amber-200 bg-amber-50 text-amber-800'
                  }`}
                >
                  <p className="font-medium">
                    {isAdvanceLiquidation
                      ? 'This liquidation takes back more than is owed.'
                      : overDeductions.length === 1
                        ? 'A deduction is more than the balance owed.'
                        : `${overDeductions.length} deductions are more than the balance owed.`}
                  </p>
                  <ul className="mt-0.5 space-y-0.5">
                    {overDeductions.slice(0, 5).map((o) => (
                      <li key={o.name}>
                        {o.name} — deducting {fmtMoney(o.deducting)}, owes {fmtMoney(o.balance)}
                      </li>
                    ))}
                    {overDeductions.length > 5 && <li>and {overDeductions.length - 5} more</li>}
                  </ul>
                  <p
                    className={`mt-0.5 ${isAdvanceLiquidation ? 'text-red-700' : 'text-amber-700'}`}
                  >
                    {isAdvanceLiquidation
                      ? 'Lower the amount taken back to what they owe, or check the name matches their Special Account.'
                      : 'You can still record it; the balance stops at zero.'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* The sum of the lines, the way the client's form shows it: one Total Amount bar.
              The VAT inside it and any withholding sit in small print above and below, since
              they are what the accountant checks. */}
          <div className="mt-6 flex justify-end">
            <div className="min-w-[340px]">
              {vatTotal > 0 && (
                <div className="space-y-0.5 pb-1 text-right text-[12px] text-zinc-600">
                  <div>
                    Subtotal (net of VAT): <span className="font-medium">{fmtMoney(subtotal)}</span>
                  </div>
                  <div>
                    Input VAT ({VAT_RATE_PERCENT}%, included):{' '}
                    <span className="font-medium">{fmtMoney(vatTotal)}</span>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between gap-10">
                <span className="text-[15px] font-semibold text-prominent-purple-800">
                  {isAdvanceLiquidation ? 'Net of the advance' : 'Total Amount'}
                </span>
                <span className="text-[26px] font-bold text-prominent-purple-900">
                  {fmtMoney(total)}
                </span>
              </div>
              {isAdvanceLiquidation && (
                <div
                  aria-label="Liquidation summary"
                  className="mt-2 space-y-0.5 rounded-lg bg-prominent-purple-50 px-3 py-2 text-[12px] text-zinc-700"
                >
                  <div className="flex justify-between gap-6">
                    <span>Receipts (spent)</span>
                    <span className="font-medium tabular-nums">
                      {fmtMoney(round2(total - advanceTakenBack))}
                    </span>
                  </div>
                  <div className="flex justify-between gap-6">
                    <span>Advance being liquidated</span>
                    <span className="font-medium tabular-nums">−{fmtMoney(-advanceTakenBack)}</span>
                  </div>
                  <div className="flex justify-between gap-6 border-t border-prominent-purple-100 pt-1 font-semibold text-prominent-purple-900">
                    <span>
                      {netPayable < 0
                        ? 'Change returned by the employee'
                        : netPayable > 0
                          ? 'Still to reimburse the employee'
                          : 'Nothing to return or reimburse'}
                    </span>
                    <span className="tabular-nums">{fmtMoney(Math.abs(netPayable))}</span>
                  </div>
                </div>
              )}
              {/* What was withheld is owed to the BIR, not paid to the payee. */}
              {withholdingTotal > 0 && (
                <div className="space-y-0.5 pt-1 text-right text-[12px] text-zinc-600">
                  <div>
                    Less: withholding tax:{' '}
                    <span className="font-medium">−{fmtMoney(withholdingTotal)}</span>
                  </div>
                  <div>
                    Net payable: <span className="font-semibold">{fmtMoney(netPayable)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {showPlateCol && (
            <div className="mt-4 flex items-start gap-2 text-[13px] text-zinc-500">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Plate Number is required for Fuel and Lubricants and for Vehicle Repairs and
                Maintenance; Liters is optional.
              </p>
            </div>
          )}
        </section>

        {/* ③ Attachments and ④ Notes. */}
        <div className="grid gap-x-10 gap-y-6 border-t border-zinc-200 pt-6 lg:grid-cols-2">
          <ExpenseAttachmentsPanel
            bare
            title={<SectionTitle n={3} title="Attachments" suffix="(optional)" />}
            expenseId={initial?.id}
            staged={stagedAttachments}
            onStagedChange={setStagedAttachments}
          />
          <section>
            <SectionTitle n={4} title="Notes" suffix="(optional)" />
            <textarea
              aria-label="Notes"
              rows={4}
              maxLength={2000}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Additional notes..."
              className="mt-3 w-full resize-y rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
            />
          </section>
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
