'use client'

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, PhilippinePeso } from 'lucide-react'
import {
  APBills,
  APBillSuppliers,
  BankAccounts,
  fmtMoney,
  type APBill,
  type APBillSupplierOption,
  type BankAccount,
  type APBillLineDiscount,
} from '@/src/libs/data/AccountingV2Data'
import CategorySelect, { type CategorySelectOption } from '@/src/components/ui/CategorySelect'
import { Select } from '@/src/components/ui/Select'

const PAYABLE_STATUSES = ['RECEIVED', 'PARTIAL', 'OVERDUE']

// Scenario 46 — same two choices, same wording as the Expense form's own
// Cleared control, so the two screens read identically.
const CLEARED_OPTIONS = [
  { value: 'SAME_DATE', label: 'On the same date' },
  { value: 'LATER_DATE', label: 'On a later date' },
]

const METHOD_OPTIONS = [
  { value: 'cash', label: 'Cash' },
  { value: 'check', label: 'Check' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
]

/** MM/DD/YYYY, the format used across this module's date inputs. */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function outstandingOf(b: APBill): number {
  return (b.totalAmount ?? 0) - (b.amountPaid ?? 0)
}

/** Scenario 46 — the voucher number the server will derive, previewed here so
 * the number is visible before saving rather than appearing only afterwards.
 * Mirrors generateDisbursementVoucherNumber() on the backend:
 * `<BANK>#<MMYY>-<last 4 of cheque>`. The server remains the authority — this
 * is a preview, which is why the field is read-only. */
function previewVoucher(
  bank: BankAccount | undefined,
  cheque: string,
  paymentDate: string
): string {
  const raw = bank?.bankName || bank?.name || ''
  const code =
    raw
      .replace(/[^A-Za-z0-9]/g, '')
      .toUpperCase()
      .slice(0, 3) || 'CSH'
  const d = paymentDate ? new Date(paymentDate) : new Date()
  const mmyy = String(d.getMonth() + 1).padStart(2, '0') + String(d.getFullYear()).slice(-2)
  const tail = cheque
    .replace(/[^A-Za-z0-9]/g, '')
    .slice(-4)
    .toUpperCase()
  return tail ? `${code}#${mmyy}-${tail}` : `${code}#${mmyy}-••••`
}

/** "10% + ₱200" — the chain as the invoice states it, so the unit price can be
 * read against the reason for it. A goods receipt flattens this away; the SI
 * keeps it, which is why the lines come from the invoice and not the receipt. */
function discountLabel(discounts: APBillLineDiscount[] | null | undefined): string {
  if (!discounts?.length) return '—'
  return discounts
    .map((d) => (d.type === 'percentage' ? `${d.value}%` : fmtMoney(d.value)))
    .join(' + ')
}

export default function RecordPaymentForm() {
  const router = useRouter()
  // Scenario 46 — arriving from the AP Invoices list's multi-select. The
  // selection travels in the URL rather than in memory so a refresh or a
  // shared link lands on the same prefilled form. Everything stays editable
  // once here: the payee can be changed and other invoices ticked.
  const searchParams = useSearchParams()
  const presetSupplier = searchParams.get('supplier') ?? ''
  const presetBills = useMemo(
    () => (searchParams.get('bills') ?? '').split(',').filter(Boolean),
    [searchParams]
  )
  const [presetApplied, setPresetApplied] = useState(false)
  const [presetNotice, setPresetNotice] = useState<string | null>(null)
  const [suppliers, setSuppliers] = useState<APBillSupplierOption[]>([])
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])

  const [supplierId, setSupplierId] = useState(presetSupplier)
  const [bills, setBills] = useState<APBill[]>([])
  const [loadingBills, setLoadingBills] = useState(false)

  // billId -> amount being paid against it. Presence in this map IS the
  // selection, so unticking a row also drops whatever was typed in it.
  const [allocations, setAllocations] = useState<Record<string, string>>({})

  const [form, setForm] = useState({
    bankAccountId: '',
    chequeNumber: '',
    method: 'check',
    reference: '',
    paymentDate: todayIso(),
    clearedType: 'SAME_DATE',
    clearedDate: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    APBillSuppliers.list().then((r) => setSuppliers(r.data?.data ?? []))
    BankAccounts.list().then((r) => setBankAccounts(r.data ?? []))
  }, [])

  // Beat 2 — choosing the payee loads their open bills. Selection resets with
  // it: an allocation against a previous supplier's bill must never survive.
  const loadBills = useCallback(async () => {
    if (!supplierId) {
      setBills([])
      setAllocations({})
      return
    }
    setLoadingBills(true)
    const res = await APBills.list({ supplierId })
    const open = (res.data?.items ?? []).filter(
      (b) => PAYABLE_STATUSES.includes(b.status) && outstandingOf(b) > 0.005
    )
    setBills(open)
    setAllocations({})
    setLoadingBills(false)
  }, [supplierId])

  useEffect(() => {
    loadBills()
  }, [loadBills])

  // Tick whatever the list sent over, once, after that supplier's invoices are
  // in. A bill that was settled by someone else in between simply isn't in
  // `bills` any more — it is dropped with a notice rather than failing the
  // whole payment.
  useEffect(() => {
    if (presetApplied || !presetBills.length || !bills.length) return
    const found = bills.filter((b) => presetBills.includes(b.id))
    if (found.length) {
      const next: Record<string, string> = {}
      for (const b of found) next[b.id] = String(outstandingOf(b).toFixed(2))
      setAllocations(next)
    }
    const missing = presetBills.length - found.length
    if (missing > 0) {
      setPresetNotice(
        `${missing} of the ${presetBills.length} invoices you selected is no longer payable and was left out.`
      )
    }
    setPresetApplied(true)
  }, [bills, presetBills, presetApplied])

  const supplierOptions: CategorySelectOption[] = useMemo(
    () => suppliers.map((s) => ({ id: s.id, name: `${s.code} — ${s.name}`, depth: 0 })),
    [suppliers]
  )
  const bankOptions: CategorySelectOption[] = useMemo(
    () =>
      bankAccounts
        .filter((b) => b.isActive)
        .map((b) => ({ id: b.id, name: `${b.accountNumber} - ${b.name}`, depth: 0 })),
    [bankAccounts]
  )

  const selectedBank = bankAccounts.find((b) => b.id === form.bankAccountId)
  const selectedIds = Object.keys(allocations)
  const total = selectedIds.reduce((sum, id) => sum + (Number(allocations[id]) || 0), 0)
  const requiresBank = form.method !== 'cash'

  const toggle = (bill: APBill, on: boolean) => {
    setAllocations((prev) => {
      const next = { ...prev }
      if (on) next[bill.id] = String(outstandingOf(bill).toFixed(2))
      else delete next[bill.id]
      return next
    })
  }

  const allOn = bills.length > 0 && selectedIds.length === bills.length
  const toggleAll = (on: boolean) => {
    if (!on) return setAllocations({})
    const next: Record<string, string> = {}
    for (const b of bills) next[b.id] = String(outstandingOf(b).toFixed(2))
    setAllocations(next)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (selectedIds.length === 0) return setError('Select at least one invoice to pay.')
    if (requiresBank && !form.bankAccountId)
      return setError(`Source of Fund is required for ${form.method.replace('_', ' ')} payments.`)
    if (form.clearedType === 'LATER_DATE' && !form.clearedDate)
      return setError('Give the date the cheque clears, or set Cleared back to the same date.')

    const rows = selectedIds.map((id) => ({ apBillId: id, amount: Number(allocations[id]) }))
    for (const r of rows) {
      if (!(r.amount > 0)) return setError('Every selected invoice needs an amount above zero.')
      const bill = bills.find((b) => b.id === r.apBillId)!
      if (r.amount > outstandingOf(bill) + 0.01)
        return setError(
          `${bill.billNumber ?? 'An invoice'} only has ${fmtMoney(outstandingOf(bill))} outstanding.`
        )
    }

    setSaving(true)
    const res = await APBills.createDisbursement({
      supplierId,
      bankAccountId: form.bankAccountId || undefined,
      chequeNumber: form.chequeNumber || undefined,
      method: form.method || undefined,
      reference: form.reference || undefined,
      paymentDate: new Date(form.paymentDate).toISOString(),
      clearedType: form.clearedType,
      clearedDate:
        form.clearedType === 'LATER_DATE' && form.clearedDate
          ? new Date(form.clearedDate).toISOString()
          : undefined,
      notes: form.notes || undefined,
      allocations: rows,
    })
    setSaving(false)
    if (!res.success) {
      setError(res.message || res.error || 'Could not record this payment')
      return
    }
    router.push('/accounting/ap-bills/payments')
  }

  return (
    <form onSubmit={submit} className="px-4 py-4 sm:px-6 lg:px-8">
      <Link
        href="/accounting/ap-bills"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" /> Back to AP Invoices
      </Link>

      <h1 className="mt-2 text-[19px] font-bold text-prominent-purple-900">Record Payment</h1>
      <p className="mb-4 text-[13px] text-gray-500">
        One cheque, one voucher — covering as many of this supplier&rsquo;s invoices as you select.
      </p>

      {/* Beat 1 — who are we paying. Nothing else shows until this is set. */}
      <div className="max-w-md">
        <label className="mb-1 block text-xs font-medium text-gray-600">Payee *</label>
        <CategorySelect
          compact
          aria-label="Select supplier"
          noun="suppliers"
          value={supplierId}
          onChange={(id) => setSupplierId(id ?? '')}
          options={supplierOptions}
          placeholder="— Select a supplier —"
        />
      </div>

      {supplierId && (
        <>
          {/* Beat 2 — their open invoices. */}
          <div className="mt-5 rounded-lg border border-gray-200 bg-white">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
              <h2 className="text-[14px] font-semibold text-prominent-purple-900">Open invoices</h2>
              {bills.length > 0 && (
                <label className="flex items-center gap-2 text-[12px] text-gray-600">
                  <input
                    type="checkbox"
                    checked={allOn}
                    onChange={(e) => toggleAll(e.target.checked)}
                  />
                  Select all
                </label>
              )}
            </div>
            {loadingBills ? (
              <p className="flex items-center gap-2 px-4 py-6 text-[13px] text-gray-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading invoices…
              </p>
            ) : bills.length === 0 ? (
              <p className="px-4 py-6 text-center text-[13px] text-gray-400">
                This supplier has no open invoices.
              </p>
            ) : (
              <table className="w-full text-[13px]">
                <thead className="bg-gray-50 text-[11px] uppercase text-gray-600">
                  <tr>
                    <th className="w-10 px-3 py-2"></th>
                    <th className="px-3 py-2 text-left">SI #</th>
                    <th className="px-3 py-2 text-left">Account</th>
                    <th className="px-3 py-2 text-left">Due</th>
                    <th className="px-3 py-2 text-right">Outstanding</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {bills.map((b) => {
                    const on = b.id in allocations
                    const out = outstandingOf(b)
                    const amt = Number(allocations[b.id] ?? 0)
                    const partial = on && amt > 0 && amt < out - 0.01
                    const lines = b.lines ?? []
                    return (
                      /* One group per invoice: the SI as a header row, its own
                         line items nested beneath it — the same shape the
                         Expense form uses. The items are read-only here: you
                         are paying an invoice, not re-pricing it. */
                      <Fragment key={b.id}>
                        <tr className={on ? 'bg-emerald-50/60' : 'bg-gray-50/60'}>
                          <td className="px-3 py-2 align-top">
                            <input
                              type="checkbox"
                              aria-label={`Pay ${b.billNumber ?? 'invoice'}`}
                              checked={on}
                              onChange={(e) => toggle(b, e.target.checked)}
                            />
                          </td>
                          <td className="px-3 py-2 font-mono text-xs font-semibold text-prominent-purple-900">
                            {b.billNumber ?? (
                              <span className="rounded-full bg-amber-50 px-2 py-0.5 font-sans text-[11px] font-medium text-amber-700">
                                No SI
                              </span>
                            )}
                          </td>
                          {/* Always Accounts Payable — settling a payable is
                              what this screen does, so it isn't a choice. */}
                          <td className="px-3 py-2 text-gray-500">Accounts Payable</td>
                          <td className="px-3 py-2 text-xs">
                            {b.dueDate ? new Date(b.dueDate).toLocaleDateString('en-US') : '—'}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(out)}</td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              aria-label={`Amount for ${b.billNumber ?? 'invoice'}`}
                              disabled={!on}
                              value={allocations[b.id] ?? ''}
                              onChange={(e) =>
                                setAllocations((p) => ({ ...p, [b.id]: e.target.value }))
                              }
                              className="w-32 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-right text-[13px] outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500 disabled:bg-zinc-50 disabled:text-zinc-400"
                            />
                            {partial && (
                              <p className="mt-0.5 text-[11px] text-amber-600">
                                Partial — {fmtMoney(out - amt)} will remain
                              </p>
                            )}
                          </td>
                        </tr>

                        {lines.length > 0 && (
                          <tr className={on ? 'bg-emerald-50/20' : undefined}>
                            <td />
                            <td colSpan={5} className="px-3 pb-3 pt-0">
                              <table className="w-full text-[12px]">
                                <thead className="text-[10px] uppercase tracking-wider text-gray-400">
                                  <tr>
                                    <th className="py-1 pr-4 text-left font-medium">Item</th>
                                    <th className="py-1 pr-4 text-right font-medium">Qty</th>
                                    <th className="py-1 pr-4 text-right font-medium">Unit Price</th>
                                    <th className="py-1 pr-4 text-right font-medium">Discount</th>
                                    <th className="py-1 text-right font-medium">Total</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {lines.map((l) => (
                                    <tr key={l.id} className="text-gray-600">
                                      <td className="py-1 pr-4">
                                        {l.item?.name ?? l.description ?? '—'}
                                        {l.item?.sku && (
                                          <span className="ml-1 font-mono text-[10px] text-gray-400">
                                            {l.item.sku}
                                          </span>
                                        )}
                                      </td>
                                      <td className="py-1 pr-4 text-right tabular-nums">
                                        {Number(l.quantity)}
                                      </td>
                                      <td className="py-1 pr-4 text-right tabular-nums">
                                        {fmtMoney(Number(l.unitPrice))}
                                      </td>
                                      <td className="py-1 pr-4 text-right text-gray-500">
                                        {discountLabel(l.discounts)}
                                      </td>
                                      <td className="py-1 text-right tabular-nums">
                                        {fmtMoney(Number(l.lineTotal))}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        )}

                        {lines.length === 0 && (
                          <tr className={on ? 'bg-emerald-50/20' : undefined}>
                            <td />
                            <td
                              colSpan={5}
                              className="px-3 pb-2 pt-0 text-[11px] italic text-gray-400"
                            >
                              No item detail on this invoice — entered before invoice lines existed,
                              or keyed as a total only.
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Beat 3 — the rest of the form appears only once something is
              selected, so an empty screen never asks for a cheque number. */}
          {selectedIds.length > 0 && (
            <div className="mt-4 rounded-lg border border-gray-200 bg-white p-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-gray-600">Date *</span>
                  <input
                    required
                    type="date"
                    value={form.paymentDate}
                    onChange={(e) => setForm({ ...form, paymentDate: e.target.value })}
                    className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-gray-600">Cleared</span>
                  <Select
                    compact
                    value={form.clearedType}
                    onChange={(clearedType) =>
                      setForm({
                        ...form,
                        clearedType,
                        // Switching back to same-date drops a date that no
                        // longer means anything, so it can't be submitted stale.
                        clearedDate: clearedType === 'LATER_DATE' ? form.clearedDate : '',
                      })
                    }
                    options={CLEARED_OPTIONS}
                  />
                </label>
                {form.clearedType === 'LATER_DATE' && (
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-gray-600">
                      Clear date *
                    </span>
                    <input
                      required
                      type="date"
                      value={form.clearedDate}
                      onChange={(e) => setForm({ ...form, clearedDate: e.target.value })}
                      className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                    />
                  </label>
                )}
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-gray-600">Paid from *</span>
                  <Select
                    compact
                    value={form.method}
                    onChange={(method) =>
                      setForm({
                        ...form,
                        method,
                        bankAccountId: method === 'cash' ? '' : form.bankAccountId,
                      })
                    }
                    options={METHOD_OPTIONS}
                  />
                </label>
                {requiresBank && (
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-gray-600">
                      Bank Account *
                    </span>
                    <CategorySelect
                      compact
                      aria-label="Select bank account"
                      noun="bank accounts"
                      value={form.bankAccountId}
                      onChange={(id) => setForm({ ...form, bankAccountId: id ?? '' })}
                      options={bankOptions}
                      placeholder="— Select —"
                    />
                  </label>
                )}
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-gray-600">Check #</span>
                  <input
                    value={form.chequeNumber}
                    onChange={(e) => setForm({ ...form, chequeNumber: e.target.value })}
                    className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-gray-600">Voucher #</span>
                  <input
                    readOnly
                    aria-label="Voucher number (generated)"
                    title="Generated from the bank and check number"
                    value={previewVoucher(selectedBank, form.chequeNumber, form.paymentDate)}
                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-[13px] text-zinc-500 outline-none"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-gray-600">Reference</span>
                  <input
                    value={form.reference}
                    onChange={(e) => setForm({ ...form, reference: e.target.value })}
                    className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-xs font-medium text-gray-600">Description</span>
                  <input
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                  />
                </label>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
                <span className="text-[13px] text-gray-500">
                  {selectedIds.length} invoice{selectedIds.length === 1 ? '' : 's'} selected
                </span>
                <span className="text-[15px] font-semibold text-prominent-purple-900">
                  Total <span className="tabular-nums">{fmtMoney(total)}</span>
                </span>
              </div>
            </div>
          )}
        </>
      )}

      {presetNotice && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
          {presetNotice}
        </p>
      )}
      {error && <p className="mt-3 text-[13px] text-red-600">{error}</p>}

      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={saving || selectedIds.length === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-purple-700 px-5 py-2 text-sm font-semibold text-white hover:bg-purple-800 disabled:opacity-60"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <PhilippinePeso className="h-4 w-4" />
          )}
          {saving ? 'Recording…' : 'Record Payment'}
        </button>
        <Link
          href="/accounting/ap-bills"
          className="rounded-lg border border-gray-200 px-5 py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          Cancel
        </Link>
      </div>
    </form>
  )
}
