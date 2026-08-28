'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
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
  APBillMatching,
  BankAccounts,
  type APBill,
  type APBillPayment,
  type APBillPurchaseOrderOption,
  type APBillGoodsReceiptOption,
  type APBillMatchCheck,
  type BankAccount,
  fmtMoney,
  fmtDate,
} from '@/src/libs/data/AccountingV2Data'
import { SupplierSearchCombobox } from '@/src/components/inventory/SupplierSearchCombobox'
import Tooltip from '@/src/components/ui/Tooltip'
import VoucherPanel from './VoucherPanel'
import SupplierDebitMemoDialog from './SupplierDebitMemoDialog'
import { getApPaymentDocument } from '../_actions/get-ap-payment-document'
import {
  printInventoryDocument,
  type PrintDocumentEnvelope,
} from '@/src/libs/print/printInventoryDocument'

function renderApChequeBody(doc: PrintDocumentEnvelope): string {
  const d = doc.document as Record<string, unknown>
  return `<h2>Cheque Payment</h2><div class="meta">
    <div><p class="label">Payee</p><p>${d.payee ?? '—'}</p></div>
    <div><p class="label">Bill No.</p><p>${d.billNumber ?? '—'}</p></div>
    <div><p class="label">Cheque No.</p><p>${d.chequeNumber ?? '—'}</p></div>
    <div><p class="label">Amount</p><p>${fmtMoney(Number(d.amount ?? 0))}</p></div>
    <div><p class="label">Withholding</p><p>${fmtMoney(Number(d.withholdingAmount ?? 0))}</p></div>
    <div><p class="label">Payment Date</p><p>${d.paymentDate ? new Date(d.paymentDate as string).toLocaleDateString('en-PH') : '—'}</p></div>
    <div><p class="label">Method</p><p>${d.method ?? '—'}</p></div>
    <div><p class="label">Reference</p><p>${d.reference ?? '—'}</p></div>
  </div>${d.notes ? `<h2>Notes</h2><p style="font-size:13px">${d.notes}</p>` : ''}`
}

function latestChequePayment(bill: APBill): APBillPayment | undefined {
  return (bill.payments ?? [])
    .filter((p) => p.chequeNumber)
    .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())[0]
}

const VOUCHER_STATUS_LABEL: Record<string, string> = {
  pending_online_approval: 'Pending Online Approval',
  pending_onsite_approval: 'Pending Onsite Approval',
  approved: 'Approved',
  rejected: 'Rejected',
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
  const [editing, setEditing] = useState<APBill | null>(null)
  const [creating, setCreating] = useState(false)
  const [payingFor, setPayingFor] = useState<APBill | null>(null)
  const [voucherFor, setVoucherFor] = useState<APBill | null>(null)
  const [printingChequeFor, setPrintingChequeFor] = useState<string | null>(null)
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
  const printCheque = async (bill: APBill) => {
    const payment = latestChequePayment(bill)
    if (!payment) return
    setPrintingChequeFor(bill.id)
    try {
      const res = await getApPaymentDocument(bill.id, payment.id)
      if (res.success && res.data)
        printInventoryDocument(res.data, 'AP Cheque Payment', renderApChequeBody)
    } finally {
      setPrintingChequeFor(null)
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
          <h2 className="text-2xl font-bold">AP Bills</h2>
          <p className="text-sm text-gray-500">Supplier bills and payables.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="flex items-center gap-2 px-3 py-2 text-sm text-purple-700 hover:bg-purple-50 rounded-lg"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-purple-700 text-white rounded-lg hover:bg-purple-800"
          >
            <Plus className="w-4 h-4" /> New Bill
          </button>
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
                    {b.billNumber}
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
                      {latestChequePayment(b) && (
                        <Tooltip label="Print cheque">
                          <button
                            onClick={() => printCheque(b)}
                            aria-label="Print cheque"
                            disabled={printingChequeFor === b.id}
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
                        <button
                          onClick={() => setEditing(b)}
                          aria-label="Edit"
                          className="p-1.5 text-purple-600 hover:bg-purple-50 rounded"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
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

      {(creating || editing) && (
        <BillForm
          initial={editing}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
          onSaved={() => {
            setCreating(false)
            setEditing(null)
            load()
          }}
        />
      )}
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

function BillForm({
  initial,
  onClose,
  onSaved,
}: {
  initial: APBill | null
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    supplierId: initial?.supplierId ?? '',
    purchaseOrderId: initial?.purchaseOrderId ?? '',
    goodsReceiptIds: initial?.goodsReceipts?.map((r) => r.id) ?? ([] as string[]),
    billDate: initial?.billDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    dueDate:
      initial?.dueDate?.slice(0, 10) ??
      new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    description: initial?.description ?? '',
    subtotal: String(initial?.subtotal ?? ''),
    taxAmount: String(initial?.taxAmount ?? ''),
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [purchaseOrders, setPurchaseOrders] = useState<APBillPurchaseOrderOption[]>([])
  const [receipts, setReceipts] = useState<APBillGoodsReceiptOption[]>([])
  const [matchCheck, setMatchCheck] = useState<APBillMatchCheck | null>(null)
  const supplierIdOnMount = useRef(form.supplierId)

  useEffect(() => {
    if (!form.supplierId) {
      setPurchaseOrders([])
      return
    }
    // Only reset the previously-picked PO when the supplier actually
    // changes after mount — not on the initial load of an existing bill.
    if (form.supplierId !== supplierIdOnMount.current) {
      setForm((f) => ({ ...f, purchaseOrderId: '', goodsReceiptIds: [] }))
    }
    APBillMatching.purchaseOrders(form.supplierId).then((r) =>
      setPurchaseOrders(r.data?.data ?? [])
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.supplierId])

  useEffect(() => {
    if (!form.purchaseOrderId) {
      setReceipts([])
      return
    }
    APBillMatching.receipts(form.purchaseOrderId).then((r) => setReceipts(r.data?.data ?? []))
  }, [form.purchaseOrderId])

  useEffect(() => {
    if (!initial?.id || !initial?.purchaseOrderId) return
    APBillMatching.matchCheck(initial.id).then((r) => setMatchCheck(r.data ?? null))
  }, [initial?.id, initial?.purchaseOrderId])

  const toggleReceipt = (id: string) => {
    setForm((f) => ({
      ...f,
      goodsReceiptIds: f.goodsReceiptIds.includes(id)
        ? f.goodsReceiptIds.filter((r) => r !== id)
        : [...f.goodsReceiptIds, id],
    }))
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.supplierId) {
      setError('Supplier is required')
      return
    }
    setSaving(true)
    setError(null)
    const payload = {
      ...form,
      purchaseOrderId: form.purchaseOrderId || undefined,
      goodsReceiptIds: form.purchaseOrderId ? form.goodsReceiptIds : undefined,
      subtotal: Number(form.subtotal),
      taxAmount: Number(form.taxAmount || 0),
    }
    const res = initial ? await APBills.update(initial.id, payload) : await APBills.create(payload)
    setSaving(false)
    if (!res.success) {
      setError(res.message || res.error || 'Save failed')
      return
    }
    onSaved()
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="text-lg font-semibold">{initial ? 'Edit Bill' : 'New Bill'}</h3>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <Field label="Supplier *">
            <SupplierSearchCombobox
              value={form.supplierId}
              onChange={(id) => setForm({ ...form, supplierId: id })}
              initialLabel={
                initial?.supplier
                  ? `${initial.supplier.code} — ${initial.supplier.name}`
                  : undefined
              }
            />
          </Field>
          {form.supplierId && (
            <Field label="Purchase Order (for the 3-way match)">
              <select
                value={form.purchaseOrderId}
                onChange={(e) => setForm({ ...form, purchaseOrderId: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              >
                <option value="">— None —</option>
                {purchaseOrders.map((po) => (
                  <option key={po.id} value={po.id}>
                    {po.code} — {fmtMoney(po.totalAmount)} ({po.status})
                  </option>
                ))}
              </select>
            </Field>
          )}
          {form.purchaseOrderId && (
            <Field label="Receiving Reports matched to this bill">
              {receipts.length === 0 ? (
                <p className="text-xs text-gray-400">
                  No receiving reports posted against this PO yet.
                </p>
              ) : (
                <div className="space-y-1 border border-gray-200 rounded-lg p-2 max-h-28 overflow-y-auto">
                  {receipts.map((r) => (
                    <label key={r.id} className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={form.goodsReceiptIds.includes(r.id)}
                        onChange={() => toggleReceipt(r.id)}
                      />
                      {r.code} — {fmtDate(r.receivedAt)}
                    </label>
                  ))}
                </div>
              )}
            </Field>
          )}
          {matchCheck?.applicable && (
            <div
              className={`text-xs px-3 py-2 rounded-lg ${
                matchCheck.matched ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
              }`}
            >
              3-way match:{' '}
              <span className="font-semibold">{matchCheck.matched ? 'Matched' : 'Variance'}</span>
              {' — '}PO {fmtMoney(matchCheck.poTotal ?? 0)} · RRs{' '}
              {fmtMoney(matchCheck.rrTotal ?? 0)} · Bill {fmtMoney(matchCheck.invoiceTotal)}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Bill Date *">
              <input
                required
                type="date"
                value={form.billDate}
                onChange={(e) => setForm({ ...form, billDate: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </Field>
            <Field label="Due Date *">
              <input
                required
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </Field>
          </div>
          <Field label="Description">
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Subtotal *">
              <input
                required
                type="number"
                step="0.01"
                value={form.subtotal}
                onChange={(e) => setForm({ ...form, subtotal: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </Field>
            <Field label="Tax">
              <input
                type="number"
                step="0.01"
                value={form.taxAmount}
                onChange={(e) => setForm({ ...form, taxAmount: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </Field>
          </div>
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
              className="px-4 py-2 text-sm font-semibold bg-purple-700 text-white rounded-lg disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
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
    withholdingAmount: '0',
    paymentDate: new Date().toISOString().slice(0, 10),
    method: '',
    reference: '',
    chequeNumber: '',
    notes: '',
    // Which bank/cash fund the money actually paid out of — distinct from
    // Method (how it was paid). Optional: not every payment goes through a
    // tracked fund account.
    bankAccountId: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  useEffect(() => {
    BankAccounts.list().then((res) => setBankAccounts(res.data ?? []))
  }, [])
  const totalSettled = (Number(form.amount) || 0) + (Number(form.withholdingAmount) || 0)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const res = await APBills.recordPayment(bill.id, {
      ...form,
      amount: Number(form.amount),
      withholdingAmount: Number(form.withholdingAmount || 0),
      chequeNumber: form.method === 'check' ? form.chequeNumber || undefined : undefined,
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
          <Field label="Withholding Tax (if you withheld from supplier)">
            <input
              type="number"
              step="0.01"
              value={form.withholdingAmount}
              onChange={(e) => setForm({ ...form, withholdingAmount: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </Field>
          <div className="text-xs text-gray-500">
            Total settled on AP: <span className="font-semibold">{fmtMoney(totalSettled)}</span>
          </div>
          <Field label="Payment Date *">
            <input
              required
              type="date"
              value={form.paymentDate}
              onChange={(e) => setForm({ ...form, paymentDate: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </Field>
          <Field label="Method">
            <select
              value={form.method}
              onChange={(e) => setForm({ ...form, method: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            >
              <option value="">— Select —</option>
              <option value="cash">Cash</option>
              <option value="check">Check</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="gcash">GCash</option>
              <option value="card">Card</option>
              <option value="other">Other</option>
            </select>
          </Field>
          {form.method === 'check' && (
            <Field label="Cheque Number *">
              <input
                required
                value={form.chequeNumber}
                onChange={(e) => setForm({ ...form, chequeNumber: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
                placeholder="e.g. 0001234"
              />
            </Field>
          )}
          <Field label="Reference">
            <input
              value={form.reference}
              onChange={(e) => setForm({ ...form, reference: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </Field>
          <Field label="Source of Fund">
            <select
              value={form.bankAccountId}
              onChange={(e) => setForm({ ...form, bankAccountId: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            >
              <option value="">— Not tracked —</option>
              {bankAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} — {acc.bankName} ({acc.accountNumber})
                </option>
              ))}
            </select>
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
