'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  Inbox,
  PhilippinePeso,
  FileText,
  Printer,
  Undo2,
  X,
} from 'lucide-react'
import {
  APBills,
  BankAccounts,
  type APBill,
  type APBillPayment,
  type BankAccount,
  fmtMoney,
  fmtDate,
} from '@/src/libs/data/AccountingV2Data'
import Tooltip from '@/src/components/ui/Tooltip'
import VoucherPanel from './VoucherPanel'
import SupplierDebitMemoDialog from './SupplierDebitMemoDialog'
import { getApPaymentDocument } from '../_actions/get-ap-payment-document'
import { printAPPaymentVoucherDocument } from '@/src/libs/print/printInventoryDocument'

// Scenario 43 Part C — any payment can be printed as a Payment voucher now
// (was cheque-only), so this is no longer filtered to a chequeNumber.
function latestPayment(bill: APBill): APBillPayment | undefined {
  return (bill.payments ?? []).sort(
    (a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()
  )[0]
}

const VOUCHER_STATUS_LABEL: Record<string, string> = {
  pending_online_approval: 'Pending Online Approval',
  pending_onsite_approval: 'Pending Onsite Approval',
  approved: 'Approved',
  rejected: 'Rejected',
  voided: 'Voided',
}

// Matches APBillDetail.tsx's own STATUS_BADGE map, ported here for the list view.
const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  RECEIVED: 'bg-blue-50 text-blue-700',
  PARTIAL: 'bg-amber-50 text-amber-700',
  OVERDUE: 'bg-red-50 text-red-700',
  PAID: 'bg-emerald-50 text-emerald-700',
  CANCELLED: 'bg-gray-100 text-gray-600',
}

export default function APBillsList() {
  const router = useRouter()
  const [items, setItems] = useState<APBill[]>([])
  const [loading, setLoading] = useState(true)
  const [payingFor, setPayingFor] = useState<APBill | null>(null)
  const [voucherFor, setVoucherFor] = useState<APBill | null>(null)
  const [printingVoucherFor, setPrintingVoucherFor] = useState<string | null>(null)
  const [debitMemoFor, setDebitMemoFor] = useState<APBill | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await APBills.list()
    setItems(res.data?.items ?? [])
    setLoading(false)
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const del = async (id: string) => {
    if (!confirm('Delete bill?')) return
    const res = await APBills.remove(id)
    if (!res.success) alert(res.message || res.error || 'Delete failed')
    load()
  }
  const printPaymentVoucher = async (bill: APBill) => {
    const payment = latestPayment(bill)
    if (!payment) return
    setPrintingVoucherFor(bill.id)
    try {
      const res = await getApPaymentDocument(bill.id, payment.id)
      if (res.success && res.data) printAPPaymentVoucherDocument(res.data)
    } finally {
      setPrintingVoucherFor(null)
    }
  }
  const receive = async (id: string) => {
    const res = await APBills.receive(id)
    if (!res.success)
      alert(res.message || res.error || 'Receive failed — check Account Mapping settings')
    load()
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold">AP Invoices</h2>
          <p className="text-sm text-gray-500">Supplier bills and payables.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="flex items-center gap-2 px-3 py-2 text-sm text-purple-700 hover:bg-purple-50 rounded-lg"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <Link
            href="/accounting/ap-bills/payments"
            className="flex items-center gap-2 px-3 py-2 text-sm text-purple-700 hover:bg-purple-50 rounded-lg"
          >
            <PhilippinePeso className="w-4 h-4" /> Payments
          </Link>
          <Link
            href="/accounting/ap-bills/new"
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-purple-700 text-white rounded-lg hover:bg-purple-800"
          >
            <Plus className="w-4 h-4" /> New Bill
          </Link>
        </div>
      </div>
      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left">Bill #</th>
              <th className="px-3 py-2 text-left">Supplier</th>
              <th className="px-3 py-2 text-left">Bill Date</th>
              <th className="px-3 py-2 text-left">Due Date</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2 text-right">Paid</th>
              <th className="px-3 py-2 text-right">Outstanding</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-gray-400">
                  Loading...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-gray-400">
                  No bills.
                </td>
              </tr>
            ) : (
              items.map((b) => (
                <tr
                  key={b.id}
                  onClick={() => router.push(`/accounting/ap-bills/${b.id}`)}
                  className="cursor-pointer hover:bg-gray-50"
                >
                  <td className="px-3 py-2 font-mono text-xs">
                    {b.billNumber ?? <span className="italic text-gray-400">Pending SI #</span>}
                    {b.purchaseOrder && (
                      <span className="block text-[10px] text-gray-400">
                        PO: {b.purchaseOrder.code}
                        {b.purchaseOrder.status === 'partially_received' && (
                          <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 font-sans text-[9px] font-medium text-amber-700">
                            Partial
                          </span>
                        )}
                      </span>
                    )}
                    {(b.goodsReceipts?.length ?? 0) > 0 && (
                      <span className="block text-[10px] text-gray-400">
                        RR: {b.goodsReceipts!.map((r) => r.code).join(', ')}
                      </span>
                    )}
                    {(() => {
                      const siNumbers = Array.from(
                        new Set(
                          (b.goodsReceipts ?? [])
                            .map((r) => r.supplierInvoiceNumber)
                            .filter(Boolean)
                        )
                      )
                      const drNumbers = Array.from(
                        new Set(
                          (b.goodsReceipts ?? [])
                            .map((r) => r.deliveryReceiptNumber)
                            .filter(Boolean)
                        )
                      )
                      if (siNumbers.length === 0 && drNumbers.length === 0) return null
                      return (
                        <span className="block text-[10px] text-gray-400">
                          {siNumbers.length > 0 && <>SI: {siNumbers.join(', ')}</>}
                          {siNumbers.length > 0 && drNumbers.length > 0 && ' · '}
                          {drNumbers.length > 0 && <>DR: {drNumbers.join(', ')}</>}
                        </span>
                      )
                    })()}
                  </td>
                  <td className="px-3 py-2">
                    <div>{b.supplier?.name}</div>
                  </td>
                  <td className="px-3 py-2 text-xs">{fmtDate(b.billDate)}</td>
                  <td className="px-3 py-2 text-xs">{fmtDate(b.dueDate)}</td>
                  <td className="px-3 py-2 text-right">{fmtMoney(b.totalAmount)}</td>
                  <td className="px-3 py-2 text-right">{fmtMoney(b.amountPaid)}</td>
                  <td className="px-3 py-2 text-right">{fmtMoney(b.totalAmount - b.amountPaid)}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[b.status] ?? 'bg-gray-100 text-gray-600'}`}
                    >
                      {b.status}
                    </span>
                    {b.isAutoGenerated && b.status === 'DRAFT' && (
                      <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-purple-50 text-purple-700">
                        From Receiving
                      </span>
                    )}
                    {b.voucherApprovalStatus && (
                      <div className="mt-1 text-xs text-gray-500">
                        Voucher: {VOUCHER_STATUS_LABEL[b.voucherApprovalStatus]}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      {b.status === 'DRAFT' && (
                        <Tooltip label="Receive">
                          <button
                            onClick={() => receive(b.id)}
                            aria-label="Receive"
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded"
                          >
                            <Inbox className="w-4 h-4" />
                          </button>
                        </Tooltip>
                      )}
                      {['RECEIVED', 'PARTIAL', 'OVERDUE'].includes(b.status) && (
                        <Tooltip label="Record payment">
                          <button
                            onClick={() => setPayingFor(b)}
                            aria-label="Record payment"
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded"
                          >
                            <PhilippinePeso className="w-4 h-4" />
                          </button>
                        </Tooltip>
                      )}
                      {latestPayment(b) && (
                        <Tooltip label="Print payment voucher">
                          <button
                            onClick={() => printPaymentVoucher(b)}
                            aria-label="Print payment voucher"
                            disabled={printingVoucherFor === b.id}
                            className="p-1.5 text-sky-600 hover:bg-sky-50 rounded disabled:opacity-50"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        </Tooltip>
                      )}
                      {b.supplierId && ['RECEIVED', 'PARTIAL', 'OVERDUE'].includes(b.status) && (
                        <Tooltip label="Issue supplier debit memo (return)">
                          <button
                            onClick={() => setDebitMemoFor(b)}
                            aria-label="Issue supplier debit memo"
                            className="p-1.5 text-orange-600 hover:bg-orange-50 rounded"
                          >
                            <Undo2 className="w-4 h-4" />
                          </button>
                        </Tooltip>
                      )}
                      <Tooltip label="Voucher">
                        <button
                          onClick={() => setVoucherFor(b)}
                          aria-label="Voucher"
                          className="p-1.5 text-amber-600 hover:bg-amber-50 rounded"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                      </Tooltip>
                      <Tooltip label="Edit">
                        <Link
                          href={`/accounting/ap-bills/${b.id}/edit`}
                          aria-label="Edit"
                          className="p-1.5 text-purple-600 hover:bg-purple-50 rounded"
                        >
                          <Pencil className="w-4 h-4" />
                        </Link>
                      </Tooltip>
                      <Tooltip label="Delete">
                        <button
                          onClick={() => del(b.id)}
                          aria-label="Delete"
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </Tooltip>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {payingFor && (
        <PayBill
          bill={payingFor}
          onClose={() => setPayingFor(null)}
          onSaved={() => {
            setPayingFor(null)
            load()
          }}
        />
      )}
      {voucherFor && (
        <VoucherPanel
          bill={voucherFor}
          onClose={() => setVoucherFor(null)}
          onSaved={async () => {
            const res = await APBills.get(voucherFor.id)
            if (res.data) setVoucherFor(res.data)
            load()
          }}
        />
      )}
      {debitMemoFor && (
        <SupplierDebitMemoDialog
          bill={debitMemoFor}
          onClose={() => setDebitMemoFor(null)}
          onSaved={() => {
            setDebitMemoFor(null)
            load()
          }}
        />
      )}
    </div>
  )
}

function PayBill({
  bill,
  onClose,
  onSaved,
}: {
  bill: APBill
  onClose: () => void
  onSaved: () => void
}) {
  const out = bill.totalAmount - bill.amountPaid
  // Scenario 10 Part 5 — a PO-linked bill can't actually be paid until a
  // goods receipt is matched against it; surface that proactively instead
  // of only after the backend rejects the submit.
  const blockedByMissingReceipt = Boolean(
    bill.purchaseOrderId && (bill.goodsReceipts?.length ?? 0) === 0
  )
  const [form, setForm] = useState({
    amount: String(out),
    paymentDate: new Date().toISOString().slice(0, 10),
    notes: '',
    // Which bank/cash fund the money actually paid out of — distinct from
    // sourceOfPayment (how it was paid). Optional: not every payment goes
    // through a tracked fund account.
    bankAccountId: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  useEffect(() => {
    BankAccounts.list().then((res) => setBankAccounts(res.data ?? []))
  }, [])
  // Scenario 42 Part 4 — same rule as AR's Record Payment, just reading the
  // method from the bill itself rather than a selector in this dialog: this
  // dialog has none of its own, sourceOfPayment is set when the bill is
  // edited (see BillForm.tsx). Untracked when unset entirely — that's the
  // same as "cash" for a bill nobody's specified a method for yet.
  const requiresBankAccount = Boolean(bill.sourceOfPayment && bill.sourceOfPayment !== 'cash')
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (requiresBankAccount && !form.bankAccountId) {
      setError(`Source of Fund is required for ${bill.sourceOfPayment} payments.`)
      return
    }
    setSaving(true)
    setError(null)
    const res = await APBills.recordPayment(bill.id, {
      ...form,
      amount: Number(form.amount),
      bankAccountId: form.bankAccountId || undefined,
    })
    setSaving(false)
    if (!res.success) {
      setError(res.message || res.error || 'Save failed')
      return
    }
    onSaved()
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="text-lg font-semibold">Record Payment</h3>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          {blockedByMissingReceipt && (
            <div className="p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
              This bill is linked to a purchase order but has no goods receipt matched to it yet —
              payment will be blocked until at least one is matched (edit the bill to match one).
            </div>
          )}
          <div className="text-sm text-gray-600">
            Outstanding: <span className="font-semibold">{fmtMoney(out)}</span>
          </div>
          {(bill.withholdingAmount ?? 0) > 0 && (
            <div className="text-xs text-gray-500">
              Withholding tax of{' '}
              <span className="font-semibold">{fmtMoney(bill.withholdingAmount ?? 0)}</span> was
              already withheld and posted when this bill was received — the outstanding balance
              above already reflects it.
            </div>
          )}
          <Field label="Cash Paid *">
            <input
              required
              type="number"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </Field>
          <Field label="Payment Date *">
            <input
              required
              type="date"
              value={form.paymentDate}
              onChange={(e) => setForm({ ...form, paymentDate: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </Field>
          {(bill.sourceOfPayment || bill.referenceNumber || bill.serialNumber) && (
            <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 space-y-0.5">
              <p className="font-semibold text-gray-600">
                Set on the bill (edit the bill to change these):
              </p>
              {bill.sourceOfPayment && <p>Source of Payment: {bill.sourceOfPayment}</p>}
              {bill.referenceNumber && <p>Reference Number: {bill.referenceNumber}</p>}
              {bill.serialNumber && <p>Serial Number: {bill.serialNumber}</p>}
            </div>
          )}
          <Field label={requiresBankAccount ? 'Source of Fund *' : 'Source of Fund'}>
            <select
              required={requiresBankAccount}
              value={form.bankAccountId}
              onChange={(e) => setForm({ ...form, bankAccountId: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            >
              <option value="">{requiresBankAccount ? '— Select —' : '— Not tracked —'}</option>
              {bankAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} — {acc.bankName} ({acc.accountNumber})
                </option>
              ))}
            </select>
            {requiresBankAccount && !form.bankAccountId && (
              <p className="mt-1 text-[12px] text-amber-700">
                Required for {bill.sourceOfPayment} payments, so this shows up in Bank
                Reconciliation.
              </p>
            )}
          </Field>
          {error && (
            <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold bg-emerald-700 text-white rounded-lg disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: any }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-600 mb-1">{label}</span>
      {children}
    </label>
  )
}
