'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, Download, Loader2 } from 'lucide-react'
import { APBills, fmtMoney, fmtDate, type APBill } from '@/src/libs/data/AccountingV2Data'
import {
  printInventoryDocument,
  type PrintDocumentEnvelope,
} from '@/src/libs/print/printInventoryDocument'

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  RECEIVED: 'bg-blue-50 text-blue-700',
  PARTIAL: 'bg-amber-50 text-amber-700',
  OVERDUE: 'bg-red-50 text-red-700',
  PAID: 'bg-emerald-50 text-emerald-700',
  CANCELLED: 'bg-gray-100 text-gray-600',
}

function renderApBillBody(doc: PrintDocumentEnvelope): string {
  const bill = doc.document as Record<string, unknown>
  const supplier = bill.supplier as { name?: string } | undefined
  const purchaseOrder = bill.purchaseOrder as { code?: string } | null
  const goodsReceipts = (bill.goodsReceipts as Record<string, unknown>[] | undefined) ?? []
  const fmt = (n: number) =>
    n.toLocaleString('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 2 })
  const fmtDateStr = (v: unknown) => (v ? new Date(v as string).toLocaleDateString('en-PH') : '—')
  const totalAmount = Number(bill.totalAmount ?? 0)
  const amountPaid = Number(bill.amountPaid ?? 0)
  const outstanding = totalAmount - amountPaid

  const siNumbers = Array.from(
    new Set(goodsReceipts.map((r) => r.supplierInvoiceNumber).filter(Boolean))
  )
  const drNumbers = Array.from(
    new Set(goodsReceipts.map((r) => r.deliveryReceiptNumber).filter(Boolean))
  )

  const rrRows = goodsReceipts
    .flatMap((r) => {
      const lines = (r.lines as Record<string, unknown>[] | undefined) ?? []
      return lines.map((l) => {
        const item = l.item as { name?: string } | null
        const qty = Number(l.quantityReceived ?? 0)
        const unitCost = Number(l.unitCost ?? 0)
        const lineValue = qty * unitCost
        return `<tr><td>${r.code}</td><td>${item?.name ?? '—'}</td><td style="text-align:right">${qty}</td><td style="text-align:right">${fmt(unitCost)}</td><td style="text-align:right">${fmt(lineValue)}</td></tr>`
      })
    })
    .join('')

  return `<h2>Bill Details</h2><div class="meta">
    <div><p class="label">Supplier</p><p>${supplier?.name ?? '—'}</p></div>
    <div><p class="label">Bill Date</p><p>${fmtDateStr(bill.billDate)}</p></div>
    <div><p class="label">Due Date</p><p>${fmtDateStr(bill.dueDate)}</p></div>
    <div><p class="label">Status</p><p>${bill.status ?? '—'}</p></div>
    ${purchaseOrder ? `<div><p class="label">PO Reference</p><p>${purchaseOrder.code ?? '—'}</p></div>` : ''}
    ${siNumbers.length ? `<div><p class="label">Supplier Invoice #</p><p>${siNumbers.join(', ')}</p></div>` : ''}
    ${drNumbers.length ? `<div><p class="label">Delivery Receipt #</p><p>${drNumbers.join(', ')}</p></div>` : ''}
    ${bill.supplierInvoiceReferenceNo ? `<div><p class="label">Supplier Invoice Reference No.</p><p>${bill.supplierInvoiceReferenceNo}</p></div>` : ''}
    ${bill.sourceOfPayment ? `<div><p class="label">Source of Payment</p><p>${bill.sourceOfPayment}</p></div>` : ''}
    ${bill.referenceNumber ? `<div><p class="label">Reference Number</p><p>${bill.referenceNumber}</p></div>` : ''}
    ${bill.serialNumber ? `<div><p class="label">Serial Number</p><p>${bill.serialNumber}</p></div>` : ''}
  </div>
  ${
    rrRows
      ? `<h2>Matched Receiving Reports</h2>
  <table><thead><tr><th>RR #</th><th>Item</th><th style="text-align:right">Qty</th><th style="text-align:right">Unit Cost</th><th style="text-align:right">Value</th></tr></thead>
  <tbody>${rrRows}</tbody></table>`
      : ''
  }
  <h2>Amount</h2>
  <table><tbody>
    <tr><td>Subtotal</td><td style="text-align:right">${fmt(Number(bill.subtotal ?? 0))}</td></tr>
    <tr><td>Input Tax (VAT)</td><td style="text-align:right">${fmt(Number(bill.taxAmount ?? 0))}</td></tr>
    ${Number(bill.withholdingAmount ?? 0) > 0 ? `<tr><td>Withholding Tax</td><td style="text-align:right">${fmt(Number(bill.withholdingAmount ?? 0))}</td></tr>` : ''}
    <tr><td><strong>Total</strong></td><td style="text-align:right"><strong>${fmt(totalAmount)}</strong></td></tr>
    <tr><td>Paid</td><td style="text-align:right">${fmt(amountPaid)}</td></tr>
    <tr><td><strong>Outstanding</strong></td><td style="text-align:right"><strong>${fmt(outstanding)}</strong></td></tr>
  </tbody></table>`
}

function StatBox({
  label,
  value,
  emphasize,
}: {
  label: string
  value: string
  emphasize?: boolean
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p
        className={`mt-1 text-lg font-semibold tabular-nums ${emphasize ? 'text-red-600' : 'text-gray-900'}`}
      >
        {value}
      </p>
    </div>
  )
}

export default function APBillDetail({ id }: { id: string }) {
  const [bill, setBill] = useState<APBill | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    APBills.get(id).then((res) => {
      if (res.success && res.data) setBill(res.data)
      else setError(res.error ?? 'Bill not found')
      setLoading(false)
    })
  }, [id])

  async function handleDownload() {
    setDownloading(true)
    const res = await APBills.getDocument(id)
    setDownloading(false)
    if (res.success && res.data) printInventoryDocument(res.data, 'AP Bill', renderApBillBody)
  }

  if (loading) {
    return <div className="px-4 py-6 text-gray-400 sm:px-6 lg:px-10 lg:py-8">Loading bill…</div>
  }

  if (error || !bill) {
    return (
      <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <Link
          href="/accounting/ap-bills"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500"
        >
          <ArrowLeft className="h-4 w-4" /> Back to AP Invoices
        </Link>
        <p className="text-red-600">{error ?? 'Not found'}</p>
      </div>
    )
  }

  const outstanding = bill.totalAmount - bill.amountPaid
  const due = new Date(bill.dueDate) <= new Date() ? Math.max(outstanding, 0) : 0

  const goodsReceipts = bill.goodsReceipts ?? []
  const siNumbers = Array.from(
    new Set(goodsReceipts.map((r) => r.supplierInvoiceNumber).filter(Boolean))
  ) as string[]
  const drNumbers = Array.from(
    new Set(goodsReceipts.map((r) => r.deliveryReceiptNumber).filter(Boolean))
  ) as string[]
  const rrGrandTotal = goodsReceipts.reduce(
    (sum, r) =>
      sum + (r.lines ?? []).reduce((s, l) => s + (l.quantityReceived ?? 0) * (l.unitCost ?? 0), 0),
    0
  )

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <Link
        href="/accounting/ap-bills"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" /> Back to AP Bills
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{bill.billNumber}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500">
            {bill.supplier?.name}
            {siNumbers.length > 0 && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                SI: {siNumbers.join(', ')}
              </span>
            )}
            {bill.supplierInvoiceReferenceNo && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                Invoice Ref: {bill.supplierInvoiceReferenceNo}
              </span>
            )}
            <span
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-bold ${STATUS_BADGE[bill.status] ?? 'bg-gray-100 text-gray-600'}`}
            >
              {bill.status === 'PAID' && <CheckCircle2 className="h-4 w-4" />}
              {bill.status}
            </span>
          </div>
          <div className="mt-2 grid max-w-xs grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-1.5 text-sm">
            {bill.purchaseOrder && (
              <>
                <span className="text-gray-500">PO reference</span>
                <span className="text-left font-medium tabular-nums text-gray-800">
                  {bill.purchaseOrder.code}
                  {bill.purchaseOrder.status === 'partially_received' && (
                    <span className="ml-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                      Partially received
                    </span>
                  )}
                </span>
              </>
            )}
            {drNumbers.length > 0 && (
              <>
                <span className="text-gray-500">Delivery receipt #</span>
                <span className="text-left font-medium tabular-nums text-gray-800">
                  {drNumbers.join(', ')}
                </span>
              </>
            )}
            <span className="text-gray-500">Bill date</span>
            <span className="text-left font-medium tabular-nums text-gray-800">
              {fmtDate(bill.billDate)}
            </span>
            <span className="text-gray-500">Due date</span>
            <span className="text-left font-medium tabular-nums text-gray-800">
              {fmtDate(bill.dueDate)}
            </span>
            <span className="text-gray-500">Subtotal</span>
            <span className="text-left font-medium tabular-nums text-gray-800">
              {fmtMoney(bill.subtotal)}
            </span>
            <span className="text-gray-500">Input Tax (VAT)</span>
            <span className="text-left font-medium tabular-nums text-gray-800">
              {fmtMoney(bill.taxAmount)}
            </span>
            {(bill.withholdingAmount ?? 0) > 0 && (
              <>
                <span className="text-gray-500">Withholding Tax</span>
                <span className="text-left font-medium tabular-nums text-gray-800">
                  {fmtMoney(bill.withholdingAmount ?? 0)}
                </span>
              </>
            )}
            <span className="border-t border-gray-100 pt-1.5 font-semibold text-gray-600">
              Total
            </span>
            <span className="border-t border-gray-100 pt-1.5 text-left font-semibold tabular-nums text-gray-900">
              {fmtMoney(bill.totalAmount)}
            </span>
            {(bill.sourceOfPayment || bill.referenceNumber || bill.serialNumber) && (
              <>
                <span className="col-span-2 mt-1 border-t border-gray-100 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  How this bill is paid
                </span>
                {bill.sourceOfPayment && (
                  <>
                    <span className="text-gray-500">Source of Payment</span>
                    <span className="text-left font-medium text-gray-800">
                      {bill.sourceOfPayment}
                    </span>
                  </>
                )}
                {bill.referenceNumber && (
                  <>
                    <span className="text-gray-500">Reference Number</span>
                    <span className="text-left font-medium text-gray-800">
                      {bill.referenceNumber}
                    </span>
                  </>
                )}
                {bill.serialNumber && (
                  <>
                    <span className="text-gray-500">Serial Number</span>
                    <span className="text-left font-medium text-gray-800">{bill.serialNumber}</span>
                  </>
                )}
              </>
            )}
          </div>
        </div>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="inline-flex items-center gap-2 rounded-xl bg-prominent-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-prominent-orange-700 disabled:opacity-50"
        >
          {downloading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Print / Download
        </button>
      </header>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatBox label="Total" value={fmtMoney(bill.totalAmount)} />
        <StatBox label="Paid" value={fmtMoney(bill.amountPaid)} />
        <StatBox label="Outstanding" value={fmtMoney(outstanding)} emphasize={outstanding > 0} />
        <StatBox label="Due now" value={due > 0 ? fmtMoney(due) : '—'} emphasize={due > 0} />
      </div>

      <section className="mt-4 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-1 text-[14px] font-semibold text-gray-900">Matched Receiving Reports</h2>
        {goodsReceipts.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-gray-400">
            No receiving report matched to this bill yet.
          </p>
        ) : (
          <>
            {goodsReceipts.map((rr) => {
              const rrTotal = (rr.lines ?? []).reduce(
                (s, l) => s + (l.quantityReceived ?? 0) * (l.unitCost ?? 0),
                0
              )
              return (
                <div key={rr.id} className="mb-4 last:mb-0">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-semibold text-purple-700">
                      {rr.code}
                      {rr.receivedAt && (
                        <span className="ml-2 font-medium text-gray-500">
                          {fmtDate(rr.receivedAt)}
                        </span>
                      )}
                    </p>
                    <p className="text-sm font-semibold text-gray-900">{fmtMoney(rrTotal)}</p>
                  </div>
                  {(rr.lines?.length ?? 0) > 0 && (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-100 text-sm">
                        <thead className="text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                          <tr>
                            <th className="py-1.5 pr-4">Item</th>
                            <th className="py-1.5 pr-4 text-right">Qty</th>
                            <th className="py-1.5 pr-4 text-right">Unit cost</th>
                            <th className="py-1.5 text-right">Value</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {rr.lines!.map((l) => (
                            <tr key={l.id}>
                              <td className="py-1.5 pr-4 text-gray-900">
                                {l.item?.name ?? '—'}
                                {l.isFreebie && (
                                  <span className="ml-2 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700">
                                    Freebie
                                  </span>
                                )}
                              </td>
                              <td className="py-1.5 pr-4 text-right tabular-nums">
                                {l.quantityReceived}
                              </td>
                              <td className="py-1.5 pr-4 text-right tabular-nums">
                                {l.unitCost != null ? fmtMoney(l.unitCost) : '—'}
                              </td>
                              <td className="py-1.5 text-right tabular-nums">
                                {fmtMoney((l.quantityReceived ?? 0) * (l.unitCost ?? 0))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
            {goodsReceipts.length > 1 && (
              <p className="mt-2 border-t border-gray-100 pt-2 text-right text-[13px] text-gray-600">
                Total across {goodsReceipts.length} receiving reports:{' '}
                <span className="font-semibold text-gray-900">{fmtMoney(rrGrandTotal)}</span>
              </p>
            )}
          </>
        )}
      </section>

      <section className="mt-4 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-3 text-[14px] font-semibold text-gray-900">Payment history</h2>
        {(bill.withholdingAmount ?? 0) > 0 && (
          <p className="mb-2 text-[13px] text-gray-500">
            Withholding tax of{' '}
            <span className="font-semibold">{fmtMoney(bill.withholdingAmount ?? 0)}</span> was
            withheld and posted when this bill was received.
          </p>
        )}
        {(!bill.payments || bill.payments.length === 0) && (
          <p className="py-4 text-center text-[13px] text-gray-400">No payments recorded yet.</p>
        )}
        {bill.payments && bill.payments.length > 0 && (
          <ul className="divide-y divide-gray-100">
            {bill.payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
                <div className="text-gray-800">
                  {fmtDate(p.paymentDate)}
                  {p.method ? ` · ${p.method}` : ''}
                  {p.reference ? ` · ${p.reference}` : ''}
                </div>
                <span className="shrink-0 font-semibold tabular-nums text-gray-900">
                  {fmtMoney(p.amount + (p.withholdingAmount ?? 0))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
