'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, Download, Loader2 } from 'lucide-react'
import { APBills, fmtMoney, fmtDate, type APBill } from '@/src/libs/data/AccountingV2Data'
import { printAPBillDocument } from '@/src/libs/print/printInventoryDocument'

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  RECEIVED: 'bg-blue-50 text-blue-700',
  PARTIAL: 'bg-amber-50 text-amber-700',
  OVERDUE: 'bg-red-50 text-red-700',
  PAID: 'bg-emerald-50 text-emerald-700',
  CANCELLED: 'bg-gray-100 text-gray-600',
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
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p
        className={`mt-0.5 text-base font-semibold tabular-nums ${emphasize ? 'text-red-600' : 'text-gray-900'}`}
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
    if (res.success && res.data) printAPBillDocument(res.data)
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
  // Scenario 43 Part B — only shown when there's no goods-receipt item
  // line to show instead. Tenant-wide DEFAULT_EXPENSE mapping fallback
  // (getDocument()'s third tier) isn't resolved on this plain fetch — rare
  // enough in practice (a bill with no override AND a supplier with no
  // default) not to warrant it here; the printed document still shows it.
  const effectiveExpenseAccount =
    bill.expenseAccount ?? bill.supplier?.defaultExpenseAccount ?? null
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
    <div className="px-4 py-4 sm:px-6 lg:px-8 lg:py-5">
      <Link
        href="/accounting/ap-bills"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" /> Back to AP Invoices
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            Purchase Invoice
          </p>
          <h1 className="text-xl font-semibold text-gray-900">
            {bill.billNumber ?? <span className="italic text-gray-400">Pending SI #</span>}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[13px] text-gray-500">
            {bill.supplier?.name}
            {siNumbers.length > 0 && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                Receipt SI: {siNumbers.join(', ')}
              </span>
            )}
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[bill.status] ?? 'bg-gray-100 text-gray-600'}`}
            >
              {bill.status === 'PAID' && <CheckCircle2 className="h-3.5 w-3.5" />}
              {bill.status}
            </span>
          </div>
          <div className="mt-2 grid w-fit grid-cols-[auto_auto] items-baseline gap-x-3 gap-y-1 text-[13px]">
            {bill.purchaseOrder && (
              <>
                <span className="text-gray-500">PO reference</span>
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-left font-medium tabular-nums text-gray-800">
                  {bill.purchaseOrder.code}
                  {bill.purchaseOrder.status === 'partially_received' && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
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
          className="inline-flex items-center gap-1.5 rounded-lg bg-prominent-orange-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-prominent-orange-700 disabled:opacity-50"
        >
          {downloading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Print / Download
        </button>
      </header>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatBox label="Total" value={fmtMoney(bill.totalAmount)} />
        <StatBox label="Paid" value={fmtMoney(bill.amountPaid)} />
        <StatBox label="Outstanding" value={fmtMoney(outstanding)} emphasize={outstanding > 0} />
        <StatBox label="Due now" value={due > 0 ? fmtMoney(due) : '—'} emphasize={due > 0} />
      </div>

      <section className="mt-3 rounded-lg border border-gray-200 bg-white p-4">
        {goodsReceipts.length === 0 ? (
          <>
            <h2 className="mb-1 text-[13px] font-semibold text-gray-900">Account</h2>
            <table className="min-w-full divide-y divide-gray-100 text-[13px]">
              <thead className="text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="py-1.5 pr-4">Account</th>
                  <th className="py-1.5 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="py-1.5 pr-4 text-gray-900">
                    {effectiveExpenseAccount?.name ?? '—'}
                  </td>
                  <td className="py-1.5 text-right font-semibold tabular-nums text-gray-900">
                    {fmtMoney(bill.totalAmount)}
                  </td>
                </tr>
              </tbody>
            </table>
          </>
        ) : (
          <>
            <h2 className="mb-1 text-[13px] font-semibold text-gray-900">
              Matched Receiving Reports
            </h2>
            {goodsReceipts.map((rr) => {
              const rrTotal = (rr.lines ?? []).reduce(
                (s, l) => s + (l.quantityReceived ?? 0) * (l.unitCost ?? 0),
                0
              )
              return (
                <div key={rr.id} className="mb-3 last:mb-0">
                  <div className="mb-1.5 flex items-center justify-between">
                    <p className="text-[13px] font-semibold text-purple-700">
                      {rr.code}
                      {rr.receivedAt && (
                        <span className="ml-2 font-medium text-gray-500">
                          {fmtDate(rr.receivedAt)}
                        </span>
                      )}
                    </p>
                    <p className="text-[13px] font-semibold text-gray-900">{fmtMoney(rrTotal)}</p>
                  </div>
                  {(rr.lines?.length ?? 0) > 0 && (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-100 text-[13px]">
                        <thead className="text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                          <tr>
                            <th className="py-1 pr-4">Item</th>
                            <th className="py-1 pr-4 text-right">Qty</th>
                            <th className="py-1 pr-4 text-right">Unit cost</th>
                            <th className="py-1 text-right">Value</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {rr.lines!.map((l) => (
                            <tr key={l.id}>
                              <td className="py-1 pr-4 text-gray-900">
                                {l.item?.name ?? '—'}
                                {l.isFreebie && (
                                  <span className="ml-2 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700">
                                    Freebie
                                  </span>
                                )}
                              </td>
                              <td className="py-1 pr-4 text-right tabular-nums">
                                {l.quantityReceived}
                              </td>
                              <td className="py-1 pr-4 text-right tabular-nums">
                                {l.unitCost != null ? fmtMoney(l.unitCost) : '—'}
                              </td>
                              <td className="py-1 text-right tabular-nums">
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

      <section className="mt-3 rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-2 text-[13px] font-semibold text-gray-900">Payment history</h2>
        {(bill.withholdingAmount ?? 0) > 0 && (
          <p className="mb-2 text-[13px] text-gray-500">
            Withholding tax of{' '}
            <span className="font-semibold">{fmtMoney(bill.withholdingAmount ?? 0)}</span> was
            withheld and posted when this bill was received.
          </p>
        )}
        {(!bill.payments || bill.payments.length === 0) && (
          <p className="py-3 text-center text-[13px] text-gray-400">No payments recorded yet.</p>
        )}
        {bill.payments && bill.payments.length > 0 && (
          <ul className="divide-y divide-gray-100">
            {bill.payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2 text-[13px]">
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
