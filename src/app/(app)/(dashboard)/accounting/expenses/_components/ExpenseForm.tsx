'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import {
  Expenses,
  APBillSuppliers,
  type BusinessExpense,
  type APBillSupplierOption,
  type PayeeType,
  type LiquidatableType,
  fmtMoney,
} from '@/src/libs/data/AccountingV2Data'
import { getAccounts, type Account } from '@/src/libs/data/AccountingData'
import CustomerPicker from '@/src/components/crm/CustomerPicker'
import EmployeePicker from '@/src/components/accounting/EmployeePicker'

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

interface LineState {
  categoryAccountId: string
  employeeId: string
  employeeLabel: string
  payee: string
  description: string
  amount: string
  taxCode: string
}
function emptyLine(): LineState {
  return {
    categoryAccountId: '',
    employeeId: '',
    employeeLabel: '',
    payee: '',
    description: '',
    amount: '',
    taxCode: '',
  }
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

  useEffect(() => {
    getAccounts({ limit: 500 }).then((r) => {
      const list = ((r.data as any)?.items ?? r.data ?? []) as Account[]
      setExpenseAccounts(list.filter((a) => (a.type ?? '').toUpperCase() === 'EXPENSE'))
    })
    APBillSuppliers.list().then((r) => setSuppliers(r.data?.data ?? []))
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
      onSaved={() => router.push('/accounting/expenses')}
    />
  )
}

function ExpenseFormFields({
  initial,
  suppliers,
  expenseAccounts,
  onSaved,
}: {
  initial: BusinessExpense | null
  suppliers: APBillSupplierOption[]
  expenseAccounts: Account[]
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
  })
  const [lines, setLines] = useState<LineState[]>(
    initial?.lines && initial.lines.length > 0
      ? initial.lines.map((l) => ({
          categoryAccountId: l.categoryAccountId ?? '',
          employeeId: (l as any).employee?.id ?? '',
          employeeLabel: (l as any).employee
            ? `${(l as any).employee.firstName} ${(l as any).employee.lastName}`
            : '',
          payee: (l as any).payee ?? '',
          description: (l as any).description ?? '',
          amount: String((l as any).amount ?? ''),
          taxCode: (l as any).taxCode ?? '',
        }))
      : [emptyLine()]
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isLiquidation = form.specialAccountType === 'CA_LIQUIDATION'
  // Which type each line's "who" field is for — the direct Special Account
  // type, or (for a liquidation) whichever type is being closed out.
  const effectiveType = isLiquidation ? form.liquidatesType : form.specialAccountType
  const isEmployeeSpecialType =
    effectiveType === 'EMPLOYEE_CASH_ADVANCE' || effectiveType === 'EMPLOYEE_CASH_LOAN'
  const isCashLoanOthersType = effectiveType === 'CASH_LOAN_OTHERS'

  const total = lines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0)

  const setLine = (index: number, patch: Partial<LineState>) => {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)))
  }
  const addLine = () => setLines((prev) => [...prev, emptyLine()])
  const removeLine = (index: number) => setLines((prev) => prev.filter((_, i) => i !== index))

  const validate = (): string | null => {
    if (!form.payeeType) return 'Choose who this is for (Customer, Supplier, or Other).'
    if (form.payeeType === 'CUSTOMER' && !form.customerId) return 'Pick a customer.'
    if (form.payeeType === 'OTHER') {
      if (!form.specialAccountType) return 'Choose which Special Account type this is.'
      if (isLiquidation && !form.liquidatesType)
        return 'Choose which Special Account this liquidation is closing out.'
    }
    if (lines.length === 0) return 'Add at least one line.'
    for (const l of lines) {
      if (!l.amount || Number(l.amount) <= 0) return 'Every line needs an amount greater than 0.'
      if (form.payeeType === 'CUSTOMER' || form.payeeType === 'SUPPLIER') {
        if (!l.categoryAccountId) return 'Every line needs a category.'
      } else if (form.payeeType === 'OTHER') {
        if (isEmployeeSpecialType && !l.employeeId) return 'Every line needs an employee.'
        if (isCashLoanOthersType && !l.payee.trim())
          return isLiquidation
            ? 'Every line needs who the liquidation is for.'
            : 'Every line needs who the cash loan is for.'
      }
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
      payeeType: form.payeeType,
      description: form.description || undefined,
      paymentMethod: form.paymentMethod,
      reference: form.reference || undefined,
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
      if (form.payeeType === 'CUSTOMER' || form.payeeType === 'SUPPLIER') {
        line.categoryAccountId = l.categoryAccountId
        if (l.taxCode) line.taxCode = l.taxCode
      } else if (form.payeeType === 'OTHER') {
        if (isEmployeeSpecialType) line.employeeId = l.employeeId
        else line.payee = l.payee
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

      <h1 className="text-2xl font-semibold text-gray-900">
        {initial ? 'Edit Expense' : 'New Expense'}
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        Record and categorize a business expense. Recording posts a journal entry to the GL.
      </p>

      <form
        onSubmit={submit}
        className="mt-6 space-y-3 rounded-xl border border-gray-200 bg-white p-6"
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="max-w-xs">
            <Field label="Date *">
              <input
                required
                type="date"
                value={form.expenseDate}
                onChange={(e) => setForm({ ...form, expenseDate: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </Field>
          </div>

          <Field label="Payee *">
            <div className="grid grid-cols-3 gap-2">
              {(['CUSTOMER', 'SUPPLIER', 'OTHER'] as const).map((pt) => (
                <button
                  key={pt}
                  type="button"
                  onClick={() => {
                    setForm({
                      ...form,
                      payeeType: pt,
                      customerId: '',
                      customerLabel: '',
                      supplierId: '',
                      specialAccountType: '',
                      liquidatesType: '',
                      payee: '',
                    })
                    resetLinesForPayeeChange()
                  }}
                  className={`px-3 py-2 text-sm rounded-lg border ${
                    form.payeeType === pt
                      ? 'border-purple-600 bg-purple-50 text-purple-700 font-medium'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {pt === 'CUSTOMER' ? 'Customer' : pt === 'SUPPLIER' ? 'Supplier' : 'Other'}
                </button>
              ))}
            </div>
          </Field>
        </div>

        {form.payeeType === 'CUSTOMER' && (
          <div className="max-w-md">
            <Field label="Customer *">
              <CustomerPicker
                value={form.customerId}
                selectedLabel={form.customerLabel}
                onChange={(customerId, label) =>
                  setForm({ ...form, customerId, customerLabel: label })
                }
              />
            </Field>
          </div>
        )}

        {form.payeeType === 'SUPPLIER' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Supplier">
              <select
                aria-label="Supplier"
                value={form.supplierId}
                onChange={(e) => setForm({ ...form, supplierId: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              >
                <option value="">— None —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} — {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Payee (when no supplier)">
              <input
                value={form.payee}
                onChange={(e) => setForm({ ...form, payee: e.target.value })}
                placeholder="e.g. Meralco"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </Field>
          </div>
        )}

        {form.payeeType === 'OTHER' && (
          <div className="grid grid-cols-2 gap-3 rounded-lg border border-purple-100 bg-purple-50/40 p-3">
            <Field label="Special Account type *">
              <select
                value={form.specialAccountType}
                onChange={(e) => {
                  setForm({ ...form, specialAccountType: e.target.value, liquidatesType: '' })
                  resetLinesForPayeeChange()
                }}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              >
                <option value="">— Select —</option>
                {SPECIAL_ACCOUNT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>

            {isLiquidation && (
              <Field label="Which type is this closing out? *">
                <select
                  value={form.liquidatesType}
                  onChange={(e) => {
                    setForm({ ...form, liquidatesType: e.target.value as LiquidatableType | '' })
                    resetLinesForPayeeChange()
                  }}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
                >
                  <option value="">— Select —</option>
                  {LIQUIDATABLE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            <p className="col-span-2 text-[12px] text-purple-700">
              {isLiquidation
                ? "Each line below closes out part or all of that recipient's outstanding balance — doesn't post as a business expense."
                : "This won't post as a business expense — it's tracked as money owed back, not money spent. Add a line per recipient to batch several in one entry."}
            </p>
          </div>
        )}

        {/* Line items — Scenario 40 Part 6 */}
        {(form.payeeType === 'CUSTOMER' ||
          form.payeeType === 'SUPPLIER' ||
          (form.payeeType === 'OTHER' && (isEmployeeSpecialType || isCashLoanOthersType))) && (
          <div className="pt-2">
            <div className="grid grid-cols-12 gap-2 px-1 pb-1 text-xs font-medium text-gray-500">
              <div className="col-span-3">
                {form.payeeType === 'OTHER'
                  ? isLiquidation
                    ? 'Recipient (closing out)'
                    : 'Recipient'
                  : 'Category'}
              </div>
              <div className="col-span-4">Description</div>
              <div className="col-span-2">Amount</div>
              {(form.payeeType === 'CUSTOMER' || form.payeeType === 'SUPPLIER') && (
                <div className="col-span-2">Tax Code</div>
              )}
              <div className="col-span-1" />
            </div>
            <div className="space-y-2">
              {lines.map((line, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-start">
                  <div className="col-span-3">
                    {(form.payeeType === 'CUSTOMER' || form.payeeType === 'SUPPLIER') && (
                      <select
                        required
                        aria-label="Category"
                        value={line.categoryAccountId}
                        onChange={(e) => setLine(i, { categoryAccountId: e.target.value })}
                        className="w-full px-2 py-2 text-sm border border-gray-200 rounded-lg"
                      >
                        <option value="">— Select —</option>
                        {expenseAccounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    )}
                    {form.payeeType === 'OTHER' && isEmployeeSpecialType && (
                      <EmployeePicker
                        value={line.employeeId}
                        selectedLabel={line.employeeLabel}
                        onChange={(employeeId, label) =>
                          setLine(i, { employeeId, employeeLabel: label })
                        }
                      />
                    )}
                    {form.payeeType === 'OTHER' && isCashLoanOthersType && (
                      <input
                        value={line.payee}
                        onChange={(e) => setLine(i, { payee: e.target.value })}
                        placeholder="Anyone — not restricted to staff"
                        className="w-full px-2 py-2 text-sm border border-gray-200 rounded-lg"
                      />
                    )}
                    {isLiquidation && (isEmployeeSpecialType ? line.employeeId : line.payee) && (
                      <LiquidationBalanceHint
                        liquidatesType={form.liquidatesType}
                        employeeId={isEmployeeSpecialType ? line.employeeId : undefined}
                        payee={isCashLoanOthersType ? line.payee : undefined}
                      />
                    )}
                  </div>
                  <div className="col-span-4">
                    <input
                      aria-label="Line description"
                      value={line.description}
                      onChange={(e) => setLine(i, { description: e.target.value })}
                      className="w-full px-2 py-2 text-sm border border-gray-200 rounded-lg"
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
                      className="w-full px-2 py-2 text-sm border border-gray-200 rounded-lg"
                    />
                  </div>
                  {(form.payeeType === 'CUSTOMER' || form.payeeType === 'SUPPLIER') && (
                    <div className="col-span-2">
                      <input
                        aria-label="Tax Code"
                        value={line.taxCode}
                        onChange={(e) => setLine(i, { taxCode: e.target.value })}
                        placeholder="VAT"
                        className="w-full px-2 py-2 text-sm border border-gray-200 rounded-lg"
                      />
                    </div>
                  )}
                  <div className="col-span-1 flex justify-end pt-2">
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
            <button
              type="button"
              onClick={addLine}
              className="mt-2 flex items-center gap-1.5 text-sm text-purple-700 hover:bg-purple-50 rounded-lg px-2 py-1.5"
            >
              <Plus className="w-4 h-4" /> Add line
            </button>
          </div>
        )}

        <Field label="Description">
          <input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Payment Method">
            <select
              value={form.paymentMethod}
              onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m.replace('_', ' ')}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Reference (OR / receipt #)">
            <input
              value={form.reference}
              onChange={(e) => setForm({ ...form, reference: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </Field>
        </div>
        <div className="text-sm text-gray-600 text-right">
          Total: <span className="font-semibold">{fmtMoney(total)}</span>
        </div>
        {error && (
          <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
            {error}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-3 border-t">
          <Link
            href="/accounting/expenses"
            className="px-4 py-2 text-sm hover:bg-gray-100 rounded-lg text-gray-700"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 text-sm font-semibold bg-purple-700 text-white rounded-lg disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  )
}

/** Small self-contained fetcher — shows a recipient's outstanding balance
 * right under their picker/input once both liquidatesType and the
 * recipient are known, without the parent form having to track a
 * per-line lookup table. */
function LiquidationBalanceHint({
  liquidatesType,
  employeeId,
  payee,
}: {
  liquidatesType: '' | LiquidatableType
  employeeId?: string
  payee?: string
}) {
  const [outstanding, setOutstanding] = useState<number | null>(null)
  useEffect(() => {
    if (!liquidatesType || (!employeeId && !payee?.trim())) {
      setOutstanding(null)
      return
    }
    let cancelled = false
    Expenses.getSpecialAccountBalance({
      specialAccountType: liquidatesType,
      employeeId: employeeId || undefined,
      payee: payee?.trim() || undefined,
    }).then((res) => {
      if (!cancelled && res.success && res.data) setOutstanding(res.data.outstanding)
    })
    return () => {
      cancelled = true
    }
  }, [liquidatesType, employeeId, payee])

  if (outstanding === null) return null
  return <p className="mt-1 text-[11px] text-purple-700">Outstanding: {fmtMoney(outstanding)}</p>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-600 mb-1">{label}</span>
      {children}
    </label>
  )
}
