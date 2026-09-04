'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, Plus, Trash2 } from 'lucide-react'
import {
  Expenses,
  APBillSuppliers,
  type BusinessExpense,
  type APBillSupplierOption,
  type PayeeType,
  type LiquidatableType,
  type ExpenseTaxCode,
  fmtMoney,
} from '@/src/libs/data/AccountingV2Data'
import {
  BranchesApi,
  DepartmentsApi,
  DivisionsApi,
  type BranchLite,
  type Department,
  type Division,
} from '@/src/libs/data/OrgStructureData'
import { getAccounts, type Account } from '@/src/libs/data/AccountingData'
import CustomerPicker from '@/src/components/crm/CustomerPicker'
import CategorySelect, { type CategorySelectOption } from '@/src/components/ui/CategorySelect'
import { Select } from '@/src/components/ui/Select'

const PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'CHECK', 'CARD', 'E_WALLET']

// Scenario 40 Gap 1 + Part 2 — the Special Account list Payee → Other unlocks.
const SPECIAL_ACCOUNT_OPTIONS: { value: string; label: string }[] = [
  { value: 'EMPLOYEE_CASH_ADVANCE', label: 'Employee Cash Advance' },
  { value: 'EMPLOYEE_CASH_LOAN', label: 'Employee Cash Loan' },
  { value: 'CASH_LOAN_OTHERS', label: 'Cash Loan – Others' },
  { value: 'CA_LIQUIDATION', label: 'CA-Liquidation' },
]
// Part 2 — the three types a liquidation can actually close out.
const LIQUIDATABLE_OPTIONS: { value: LiquidatableType; label: string }[] = [
  { value: 'EMPLOYEE_CASH_ADVANCE', label: 'Employee Cash Advance' },
  { value: 'EMPLOYEE_CASH_LOAN', label: 'Employee Cash Loan' },
  { value: 'CASH_LOAN_OTHERS', label: 'Cash Loan – Others' },
]

// Scenario 45 — Utilities and Salaries & Wages are Payee choices of their
// own rather than two rows among 160 in the Category search. Both are still
// payeeType SUPPLIER underneath (same shape the backend and submit()
// already expect); picking one only pre-fills the line's category, which
// stays editable like any other. Purely a frontend affordance, no API change.
type QuickCategory = '' | 'UTILITIES' | 'SALARIES_WAGES'
const UTILITIES_ACCOUNT_NUMBER = '6-02-020'
const SALARIES_WAGES_ACCOUNT_NUMBER = '6-01-010'
const PAYEE_OPTIONS: {
  value: string
  label: string
  payeeType: PayeeType
  quick: QuickCategory
}[] = [
  { value: 'CUSTOMER', label: 'Customer', payeeType: 'CUSTOMER', quick: '' },
  { value: 'SUPPLIER', label: 'Supplier', payeeType: 'SUPPLIER', quick: '' },
  { value: 'UTILITIES', label: 'Utilities', payeeType: 'SUPPLIER', quick: 'UTILITIES' },
  {
    value: 'SALARIES_WAGES',
    label: 'Salaries & Wages',
    payeeType: 'SUPPLIER',
    quick: 'SALARIES_WAGES',
  },
  { value: 'OTHER', label: 'Special Account', payeeType: 'OTHER', quick: '' },
]

interface LineState {
  categoryAccountId: string
  payee: string
  description: string
  amount: string
  taxCode: ExpenseTaxCode
  // Payroll only — set when this line is a cash advance or cash loan rather
  // than a salary line, in which case the server resolves the category from
  // the Special Account mapping instead of categoryAccountId.
  specialAccountType: '' | PayrollSpecialAccountType
}
function emptyLine(): LineState {
  return {
    categoryAccountId: '',
    payee: '',
    description: '',
    amount: '',
    taxCode: 'NON_TAXABLE',
    specialAccountType: '',
  }
}

/** Mirrors the backend's FLAT_VAT_RATE_PERCENT — the single rate left after
 * the configurable TaxRate table was removed. */
const VAT_RATE_PERCENT = 12

// The VAT treatment replaces the free-text VAT box the form used to collect.
// Only the treatment is sent; the amount is computed from it, here for the
// running total and again server-side for what actually posts, so the two
// can't drift apart the way a typed figure could.
const VAT_OPTIONS: { value: ExpenseTaxCode; label: string }[] = [
  { value: 'NON_TAXABLE', label: 'Non-taxable' },
  { value: 'INPUT_VAT', label: `Input VAT (${VAT_RATE_PERCENT}%)` },
]
function vatFor(line: LineState): number {
  if (line.taxCode !== 'INPUT_VAT') return 0
  return Math.round((Number(line.amount) || 0) * (VAT_RATE_PERCENT / 100) * 100) / 100
}
/** Which treatment a stored line reopens with. Rows written before the
 * dropdown existed carry a legacy code (VAT/NON_VAT/EXEMPT) or none at all
 * beside a hand-typed amount — a non-zero amount on one of those was always
 * the same flat rate, so it maps onto Input VAT. */
function normalizeStoredTaxCode(taxCode?: string | null, taxAmount?: number): ExpenseTaxCode {
  const upper = (taxCode ?? '').toUpperCase()
  if (upper === 'INPUT_VAT' || upper === 'VAT') return 'INPUT_VAT'
  if (upper === 'NON_TAXABLE' || upper === 'NON_VAT' || upper === 'EXEMPT') return 'NON_TAXABLE'
  return Number(taxAmount) > 0 ? 'INPUT_VAT' : 'NON_TAXABLE'
}

// Payroll pays salaries, but it also hands out advances and loans in the
// same run. These two post to the same mapped Special Accounts a standalone
// Payee → Special Account entry hits, so an advance issued through payroll
// still shows against the recipient's outstanding balance and liquidates
// later like any other.
type PayrollSpecialAccountType = 'EMPLOYEE_CASH_ADVANCE' | 'EMPLOYEE_CASH_LOAN'
const PAYROLL_LINE_KINDS: { value: '' | PayrollSpecialAccountType; label: string }[] = [
  { value: '', label: 'Salary / Wage' },
  { value: 'EMPLOYEE_CASH_ADVANCE', label: 'Cash Advance' },
  { value: 'EMPLOYEE_CASH_LOAN', label: 'Cash Loan' },
]

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
      options.push({ id: a.id, name: a.name, depth })
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
// header + N lines, matching that same reference tool's "Add line" table.
// Which dimension is fixed at the header vs. varies per line depends on
// payeeType: CUSTOMER/SUPPLIER fixes the payee and lets each line pick its
// own category (splitting one payment across expense categories); OTHER
// fixes the Special Account category and lets each line pick its own
// recipient (a batch of cash advances to several employees in one entry).
export default function ExpenseForm({ expenseId }: { expenseId?: string }) {
  const router = useRouter()
  const [initial, setInitial] = useState<BusinessExpense | null>(null)
  const [ready, setReady] = useState(!expenseId)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [suppliers, setSuppliers] = useState<APBillSupplierOption[]>([])
  const [expenseAccounts, setExpenseAccounts] = useState<Account[]>([])
  const [branches, setBranches] = useState<BranchLite[]>([])

  useEffect(() => {
    getAccounts({ limit: 500 }).then((r) => {
      const list = ((r.data as any)?.items ?? r.data ?? []) as Account[]
      setExpenseAccounts(list.filter((a) => (a.type ?? '').toUpperCase() === 'EXPENSE'))
    })
    APBillSuppliers.list().then((r) => setSuppliers(r.data?.data ?? []))
    BranchesApi.list().then((r) => setBranches(r.data?.data ?? []))
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
      branches={branches}
      onSaved={() => router.push('/accounting/expenses')}
    />
  )
}

function ExpenseFormFields({
  initial,
  suppliers,
  expenseAccounts,
  branches,
  onSaved,
}: {
  initial: BusinessExpense | null
  suppliers: APBillSupplierOption[]
  expenseAccounts: Account[]
  branches: BranchLite[]
  onSaved: () => void
}) {
  // payeeType derivation for edit mode: new records always carry it; a
  // legacy record (saved before Scenario 40) falls back to whichever link it
  // actually has, defaulting to SUPPLIER to match the old form's default shape.
  const initialPayeeType: PayeeType | '' = initial?.payeeType ?? (initial ? 'SUPPLIER' : '')

  const [form, setForm] = useState({
    expenseDate: initial?.expenseDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    payeeType: initialPayeeType,
    supplierId: initial?.supplierId ?? '',
    customerId: initial?.customerId ?? '',
    customerLabel: initial?.customer?.name ?? '',
    specialAccountType: initial?.specialAccountType ?? '',
    liquidatesType: '' as '' | LiquidatableType,
    payee: initial?.payee ?? '',
    description: initial?.description ?? '',
    paymentMethod: initial?.paymentMethod ?? 'CASH',
    reference: initial?.reference ?? '',
    branchId: initial?.branchId ?? '',
    departmentId: initial?.departmentId ?? '',
    divisionId: initial?.divisionId ?? '',
  })
  const [lines, setLines] = useState<LineState[]>(
    initial?.lines && initial.lines.length > 0
      ? initial.lines.map((l) => ({
          categoryAccountId: l.categoryAccountId ?? '',
          // Recipient is free text now (Scenario 45) — a line saved back when
          // it was an employee link still opens with that person's name, so
          // editing an older draft doesn't silently blank the recipient.
          payee:
            (l as any).payee ||
            ((l as any).employee
              ? `${(l as any).employee.firstName} ${(l as any).employee.lastName}`
              : ''),
          description: (l as any).description ?? '',
          amount: String((l as any).amount ?? ''),
          // Legacy rows stored a typed VAT amount with no treatment beside
          // it; any non-zero tax on one of those was the same flat 12%, so
          // it reopens as Input VAT.
          taxCode: normalizeStoredTaxCode((l as any).taxCode, (l as any).taxAmount),
          // A saved cash advance/loan line is indistinguishable from a
          // salary line on read (both carry a resolved categoryAccountId),
          // so it reopens as a salary line with its category intact rather
          // than guessing. Only new lines set this.
          specialAccountType: '' as '' | PayrollSpecialAccountType,
        }))
      : [emptyLine()]
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const categoryOptions = useMemo(
    () => accountsToCategoryOptions(expenseAccounts),
    [expenseAccounts]
  )
  // Reuses CategorySelect (flat, depth 0) rather than the plain Select —
  // suppliers grew past a comfortable scroll-and-eyeball list, same reason
  // Category itself is a search box instead of a native <select>.
  const supplierOptions = useMemo(
    () => suppliers.map((s) => ({ id: s.id, name: `${s.code} — ${s.name}`, depth: 0 })),
    [suppliers]
  )

  // Scenario 45 — not reverse-detected from `initial` on edit: expenseAccounts
  // loads asynchronously after this state initializes, so editing a Utilities
  // or Salaries & Wages expense reopens as plain Supplier with its existing
  // category already selected — still correct, just not relabeled as the
  // shortcut it was entered through.
  const [quickCategory, setQuickCategory] = useState<QuickCategory>('')
  const utilitiesAccount = useMemo(
    () => expenseAccounts.find((a) => a.number === UTILITIES_ACCOUNT_NUMBER),
    [expenseAccounts]
  )
  const salariesAccount = useMemo(
    () => expenseAccounts.find((a) => a.number === SALARIES_WAGES_ACCOUNT_NUMBER),
    [expenseAccounts]
  )
  const accountIdForQuickCategory = (quick: QuickCategory) =>
    quick === 'UTILITIES'
      ? utilitiesAccount?.id
      : quick === 'SALARIES_WAGES'
        ? salariesAccount?.id
        : undefined
  const presetAccountId = accountIdForQuickCategory(quickCategory)
  const selectedPayeeOption =
    PAYEE_OPTIONS.find((o) => o.payeeType === form.payeeType && o.quick === quickCategory)?.value ??
    ''
  // Picking Utilities/Salaries & Wages before `expenseAccounts` has loaded
  // captures an empty id at that moment — fill it in once the real id
  // resolves. Only ever fills a blank: the category is editable, so a
  // deliberate pick must never be overwritten from under the user.
  useEffect(() => {
    if (!presetAccountId) return
    setLines((prev) =>
      prev.map((l) => (l.categoryAccountId ? l : { ...l, categoryAccountId: presetAccountId }))
    )
  }, [presetAccountId])

  // Salaries & Wages is the client's "Payroll" screen — the Payee shortcut
  // that routes through payeeType SUPPLIER. Its lines name people rather
  // than categories, and can be advances/loans as well as salary.
  const isPayroll = quickCategory === 'SALARIES_WAGES'

  // Department and division cascade off the branch, which is what makes the
  // Division dropdown derivable from branches and departments: pick a
  // branch to get its departments, and a department to narrow its divisions
  // (branch-wide divisions, which have no department of their own, stay in
  // the list either way).
  const [departments, setDepartments] = useState<Department[]>([])
  const [divisions, setDivisions] = useState<Division[]>([])
  useEffect(() => {
    if (!form.branchId) {
      setDepartments([])
      return
    }
    let cancelled = false
    DepartmentsApi.list({ branchId: form.branchId }).then((r) => {
      if (!cancelled) setDepartments(r.data?.data ?? [])
    })
    return () => {
      cancelled = true
    }
  }, [form.branchId])
  useEffect(() => {
    if (!form.branchId) {
      setDivisions([])
      return
    }
    let cancelled = false
    DivisionsApi.list({
      branchId: form.branchId,
      departmentId: form.departmentId || undefined,
    }).then((r) => {
      if (!cancelled) setDivisions(r.data?.data ?? [])
    })
    return () => {
      cancelled = true
    }
  }, [form.branchId, form.departmentId])

  const selectedDepartment = departments.find((d) => d.id === form.departmentId)

  const isLiquidation = form.specialAccountType === 'CA_LIQUIDATION'
  // Which type each line's "who" field is for — the direct Special Account
  // type, or (for a liquidation) whichever type is being closed out.
  // Scenario 45: every type takes a free-text recipient now, so this only
  // decides whether the line table renders at all, not which control it uses.
  const effectiveType = isLiquidation ? form.liquidatesType : form.specialAccountType
  const hasRecipientLines = SPECIAL_ACCOUNT_OPTIONS.some((o) => o.value === effectiveType)

  const subtotal = lines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0)
  const vatTotal = lines.reduce((sum, l) => sum + vatFor(l), 0)
  const total = subtotal + vatTotal

  // VAT only applies to the payee types whose lines carry their own category;
  // Special Account lines post straight to their mapped account. Payroll is
  // excluded too: neither a salary nor an advance is a VAT-able purchase.
  const showVatColumn =
    (form.payeeType === 'CUSTOMER' || form.payeeType === 'SUPPLIER') && !isPayroll

  const setLine = (index: number, patch: Partial<LineState>) => {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)))
  }
  const addLine = () =>
    setLines((prev) => [...prev, { ...emptyLine(), categoryAccountId: presetAccountId ?? '' }])
  const removeLine = (index: number) => setLines((prev) => prev.filter((_, i) => i !== index))

  const validate = (): string | null => {
    if (!form.payeeType) return 'Choose who this is for (Customer, Supplier, or Other).'
    if (form.payeeType === 'CUSTOMER' && !form.customerId) return 'Pick a customer.'
    if (form.payeeType === 'OTHER') {
      if (!form.specialAccountType) return 'Choose which Special Account type this is.'
      if (isLiquidation && !form.liquidatesType)
        return 'Choose which Special Account this liquidation is closing out.'
    }
    if (form.departmentId && !form.branchId) return 'Pick a branch for that department.'
    if (form.divisionId && !form.branchId) return 'Pick a branch for that division.'
    // Payroll is the flow the dimensions were asked for, so it's the one
    // that insists on them — but only once there are departments to pick.
    // A tenant that hasn't set any up yet keeps entering payroll rather than
    // being locked out by a settings page they haven't visited.
    if (isPayroll && departments.length > 0 && !form.departmentId)
      return 'Pick the department this payroll run is for.'
    if (lines.length === 0) return 'Add at least one line.'
    for (const l of lines) {
      if (!l.amount || Number(l.amount) <= 0) return 'Every line needs an amount greater than 0.'
      if (isPayroll) {
        if (!l.payee.trim()) return 'Every payroll line needs a name.'
        // A cash advance / cash loan line resolves its account from the
        // Special Account mapping server-side, so it needs no category.
        if (!l.specialAccountType && !l.categoryAccountId)
          return 'Every salary line needs a category.'
      } else if (form.payeeType === 'CUSTOMER' || form.payeeType === 'SUPPLIER') {
        if (!l.categoryAccountId) return 'Every line needs a category.'
      } else if (form.payeeType === 'OTHER') {
        if (hasRecipientLines && !l.payee.trim())
          return isLiquidation
            ? 'Every line needs who the liquidation is for.'
            : 'Every line needs a recipient.'
      }
    }
    return null
  }

  const resetLinesForPayeeChange = (presetCategoryId?: string) =>
    setLines([{ ...emptyLine(), categoryAccountId: presetCategoryId ?? '' }])

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
      payeeType: form.payeeType,
      description: form.description || undefined,
      paymentMethod: form.paymentMethod,
      reference: form.reference || undefined,
      // Sent as explicit nulls rather than omitted so clearing a dimension
      // on an existing draft actually clears it (PATCH treats undefined as
      // "leave alone").
      branchId: form.branchId || null,
      departmentId: form.departmentId || null,
      divisionId: form.divisionId || null,
    }
    if (form.payeeType === 'CUSTOMER') {
      payload.customerId = form.customerId
    } else if (form.payeeType === 'OTHER') {
      payload.specialAccountType = form.specialAccountType
      if (isLiquidation) payload.liquidatesType = form.liquidatesType
    } else {
      payload.supplierId = form.supplierId || undefined
      payload.payee = form.payee || undefined
    }
    payload.lines = lines.map((l) => {
      const line: Record<string, unknown> = {
        amount: Number(l.amount),
        description: l.description || undefined,
      }
      if (isPayroll) {
        // Payroll names the person on every line — "payee: name /
        // department", with the department fixed at the header.
        line.payee = l.payee.trim()
        if (l.specialAccountType) {
          // Resolves to the same mapped Special Account a standalone
          // advance would hit, so it stays liquidatable.
          line.specialAccountType = l.specialAccountType
        } else {
          line.categoryAccountId = l.categoryAccountId
        }
      } else if (form.payeeType === 'CUSTOMER' || form.payeeType === 'SUPPLIER') {
        line.categoryAccountId = l.categoryAccountId
        // Only the treatment is sent — the amount is computed server-side,
        // and drives the Input VAT debit and the header total from there.
        line.taxCode = l.taxCode
      } else if (form.payeeType === 'OTHER') {
        line.payee = l.payee
      }
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
    <div className="px-6 py-8 lg:px-10">
      <Link
        href="/accounting/expenses"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
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

      <form
        onSubmit={submit}
        className="mt-6 space-y-2.5 rounded-xl border border-gray-200 bg-white p-5"
      >
        <div className="max-w-xs">
          <Field label="Date *">
            <input
              required
              type="date"
              value={form.expenseDate}
              onChange={(e) => setForm({ ...form, expenseDate: e.target.value })}
              className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
            />
          </Field>
        </div>

        <div className="max-w-xs">
          <Field label="Payee *">
            <Select
              compact
              value={selectedPayeeOption}
              onChange={(value) => {
                const option = PAYEE_OPTIONS.find((o) => o.value === value)
                if (!option) return
                setForm({
                  ...form,
                  payeeType: option.payeeType,
                  customerId: '',
                  customerLabel: '',
                  supplierId: '',
                  specialAccountType: '',
                  liquidatesType: '',
                  payee: '',
                })
                setQuickCategory(option.quick)
                resetLinesForPayeeChange(accountIdForQuickCategory(option.quick))
              }}
              options={PAYEE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              placeholder="— Select —"
            />
          </Field>
        </div>

        {/* Branch → Department → Division. Shown for every payee type (any
            expense can be tagged to where it was incurred), but required
            only for payroll, which is what the dimensions were asked for. */}
        <div className="grid grid-cols-3 gap-3">
          <Field label={isPayroll && branches.length > 0 ? 'Branch *' : 'Branch'}>
            <Select
              compact
              value={form.branchId}
              onChange={(branchId) =>
                // Department and division are scoped to the branch, so
                // changing it drops both rather than leaving a stale pair
                // the server would reject.
                setForm({ ...form, branchId, departmentId: '', divisionId: '' })
              }
              options={branches.map((b) => ({ value: b.id, label: b.name }))}
              placeholder="— None —"
            />
          </Field>
          <Field label={isPayroll && departments.length > 0 ? 'Department *' : 'Department'}>
            <Select
              compact
              value={form.departmentId}
              onChange={(departmentId) => setForm({ ...form, departmentId, divisionId: '' })}
              options={departments.map((d) => ({ value: d.id, label: d.name }))}
              placeholder={form.branchId ? '— None —' : 'Pick a branch first'}
              disabled={!form.branchId}
            />
            {form.branchId && departments.length === 0 && (
              <p className="mt-1 text-[11px] text-zinc-400">
                None set up — add them in Settings → Departments.
              </p>
            )}
          </Field>
          <Field label="Division">
            <Select
              compact
              value={form.divisionId}
              onChange={(divisionId) => setForm({ ...form, divisionId })}
              options={divisions.map((d) => ({
                value: d.id,
                // A branch-wide division has no department of its own, so
                // label it by the branch instead of leaving it bare.
                label: d.department ? `${d.name} — ${d.department.name}` : `${d.name} — all`,
              }))}
              placeholder={form.branchId ? '— None —' : 'Pick a branch first'}
              disabled={!form.branchId}
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

        {/* Scenario 45 routes Salaries & Wages through payeeType SUPPLIER for
            the backend's benefit, but wages are paid to people, not vendors —
            so it gets no party fields at all: the Payee dropdown already says
            who this is for, and both supplierId and payee are optional in the
            payload. Utilities keeps them: Meralco really is a supplier. */}
        {form.payeeType === 'SUPPLIER' && quickCategory !== 'SALARIES_WAGES' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Supplier">
              <CategorySelect
                compact
                aria-label="Select supplier"
                value={form.supplierId}
                onChange={(id) => setForm({ ...form, supplierId: id ?? '' })}
                options={supplierOptions}
                placeholder="— None —"
              />
            </Field>
            <Field label="Payee (when no supplier)">
              <input
                value={form.payee}
                onChange={(e) => setForm({ ...form, payee: e.target.value })}
                placeholder="e.g. Meralco"
                className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
              />
            </Field>
          </div>
        )}

        {form.payeeType === 'OTHER' && (
          <div className="flex flex-wrap gap-3 rounded-xl border border-prominent-purple-100 bg-prominent-purple-50/40 p-3">
            <div className="w-full max-w-xs">
              <Field label="Special Account type *">
                <Select
                  compact
                  value={form.specialAccountType}
                  onChange={(value) => {
                    setForm({ ...form, specialAccountType: value, liquidatesType: '' })
                    resetLinesForPayeeChange()
                  }}
                  options={SPECIAL_ACCOUNT_OPTIONS}
                  placeholder="— Select —"
                />
              </Field>
            </div>

            {isLiquidation && (
              <div className="w-full max-w-xs">
                <Field label="Which type is this closing out? *">
                  <Select
                    compact
                    value={form.liquidatesType}
                    onChange={(value) => {
                      setForm({ ...form, liquidatesType: value as LiquidatableType | '' })
                      resetLinesForPayeeChange()
                    }}
                    options={LIQUIDATABLE_OPTIONS}
                    placeholder="— Select —"
                  />
                </Field>
              </div>
            )}
          </div>
        )}

        {/* Line items — Scenario 40 Part 6 */}
        {(form.payeeType === 'CUSTOMER' ||
          form.payeeType === 'SUPPLIER' ||
          (form.payeeType === 'OTHER' && hasRecipientLines)) && (
          <div className="pt-2">
            <div className="rounded-lg border border-zinc-200">
              {/* overflow-hidden used to live on the table container above, for
                  the header's rounded top corners — but that also clipped the
                  line items' CategorySelect popup whenever it opened upward
                  (position:absolute escapes the border, not overflow clipping),
                  silently eating clicks on options that render outside the
                  clipped box. Rounding the header itself gets the same corners
                  without clipping anything inside a row. */}
              <div className="grid grid-cols-12 gap-2 rounded-t-lg bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-500">
                <div className="col-span-3">
                  {isPayroll
                    ? // "payee should be name / department" — the name is
                      // per line, the department is fixed at the header, so
                      // the column header carries both.
                      selectedDepartment
                      ? `Name / ${selectedDepartment.name}`
                      : 'Name'
                    : form.payeeType === 'OTHER'
                      ? isLiquidation
                        ? 'Recipient (closing out)'
                        : 'Recipient'
                      : 'Category'}
                </div>
                {isPayroll && <div className="col-span-2">Type</div>}
                <div className={isPayroll ? 'col-span-2' : 'col-span-4'}>Description</div>
                <div className="col-span-2">Amount</div>
                {isPayroll && <div className="col-span-2">Category</div>}
                {showVatColumn && <div className="col-span-2">VAT</div>}
                <div className="col-span-1" />
              </div>
              <div className="divide-y divide-zinc-100">
                {lines.map((line, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center px-3 py-1.5">
                    <div className="col-span-3">
                      {isPayroll && (
                        <>
                          <input
                            aria-label="Name"
                            value={line.payee}
                            onChange={(e) => setLine(i, { payee: e.target.value })}
                            placeholder="Employee name"
                            className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                          />
                          {selectedDepartment && (
                            <p className="mt-1 text-[11px] text-zinc-400">
                              {selectedDepartment.name}
                            </p>
                          )}
                        </>
                      )}
                      {!isPayroll &&
                        (form.payeeType === 'CUSTOMER' || form.payeeType === 'SUPPLIER') && (
                          <CategorySelect
                            compact
                            aria-label="Category"
                            value={line.categoryAccountId}
                            onChange={(id) => setLine(i, { categoryAccountId: id ?? '' })}
                            options={categoryOptions}
                            placeholder="— Select —"
                          />
                        )}
                      {form.payeeType === 'OTHER' && hasRecipientLines && (
                        <input
                          aria-label="Recipient"
                          value={line.payee}
                          onChange={(e) => setLine(i, { payee: e.target.value })}
                          placeholder="Name of recipient"
                          className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                        />
                      )}
                      {isLiquidation && line.payee && (
                        <LiquidationBalanceHint
                          liquidatesType={form.liquidatesType}
                          payee={line.payee}
                        />
                      )}
                    </div>
                    {isPayroll && (
                      <div className="col-span-2">
                        <Select
                          compact
                          value={line.specialAccountType}
                          onChange={(value) =>
                            setLine(i, {
                              specialAccountType: value as '' | PayrollSpecialAccountType,
                              // An advance/loan resolves its account from
                              // the Special Account mapping server-side, so
                              // a category picked earlier no longer applies.
                              categoryAccountId: value ? '' : (presetAccountId ?? ''),
                            })
                          }
                          options={PAYROLL_LINE_KINDS.map((k) => ({
                            value: k.value,
                            label: k.label,
                          }))}
                        />
                      </div>
                    )}
                    <div className={isPayroll ? 'col-span-2' : 'col-span-4'}>
                      <input
                        aria-label="Line description"
                        value={line.description}
                        onChange={(e) => setLine(i, { description: e.target.value })}
                        className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        required
                        type="number"
                        step="0.01"
                        min="0.01"
                        aria-label="Amount"
                        value={line.amount}
                        onChange={(e) => setLine(i, { amount: e.target.value })}
                        className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                      />
                    </div>
                    {isPayroll && (
                      <div className="col-span-2">
                        {line.specialAccountType ? (
                          // Resolved server-side from the Special Account
                          // mapping, so there's nothing to pick here.
                          <p className="px-1 text-[12px] text-zinc-400">
                            {PAYROLL_LINE_KINDS.find((k) => k.value === line.specialAccountType)
                              ?.label ?? ''}
                          </p>
                        ) : (
                          <CategorySelect
                            compact
                            aria-label="Category"
                            value={line.categoryAccountId}
                            onChange={(id) => setLine(i, { categoryAccountId: id ?? '' })}
                            options={categoryOptions}
                            placeholder="— Select —"
                          />
                        )}
                      </div>
                    )}
                    {showVatColumn && (
                      <div className="col-span-2">
                        <Select
                          compact
                          value={line.taxCode}
                          onChange={(value) => setLine(i, { taxCode: value as ExpenseTaxCode })}
                          options={VAT_OPTIONS}
                        />
                        {vatFor(line) > 0 && (
                          <p className="mt-1 text-[11px] text-zinc-400">{fmtMoney(vatFor(line))}</p>
                        )}
                      </div>
                    )}
                    <div className="col-span-1 flex justify-end">
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
                ))}
              </div>
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
        <div className="grid grid-cols-2 gap-3">
          <Field label="Payment Method">
            <Select
              compact
              value={form.paymentMethod}
              onChange={(paymentMethod) => setForm({ ...form, paymentMethod })}
              options={PAYMENT_METHODS.map((m) => ({ value: m, label: m.replace('_', ' ') }))}
            />
          </Field>
          <Field label="Reference (OR / receipt #)">
            <input
              value={form.reference}
              onChange={(e) => setForm({ ...form, reference: e.target.value })}
              className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
            />
          </Field>
        </div>
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

/** Small self-contained fetcher — shows a recipient's outstanding balance
 * right under their input once both liquidatesType and the recipient name
 * are known, without the parent form having to track a per-line lookup
 * table. Scenario 45: matched on the typed name alone, so it only finds a
 * balance when the name matches an earlier entry exactly. */
function LiquidationBalanceHint({
  liquidatesType,
  payee,
}: {
  liquidatesType: '' | LiquidatableType
  payee?: string
}) {
  const [outstanding, setOutstanding] = useState<number | null>(null)
  useEffect(() => {
    if (!liquidatesType || !payee?.trim()) {
      setOutstanding(null)
      return
    }
    let cancelled = false
    Expenses.getSpecialAccountBalance({
      specialAccountType: liquidatesType,
      payee: payee.trim(),
    }).then((res) => {
      if (!cancelled && res.success && res.data) setOutstanding(res.data.outstanding)
    })
    return () => {
      cancelled = true
    }
  }, [liquidatesType, payee])

  if (outstanding === null) return null
  return (
    <p className="mt-1 text-[11px] text-prominent-purple-700">
      Outstanding: {fmtMoney(outstanding)}
    </p>
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
