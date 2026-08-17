'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Download, Loader2 } from 'lucide-react'
import { ARInvoices, fmtMoney, fmtDate, type ARInvoice } from '@/src/libs/data/AccountingV2Data'
import {
  printInventoryDocument,
  type PrintDocumentEnvelope,
} from '@/src/libs/print/printInventoryDocument'

// Scenario 25 — print-ready AR Invoice body, mirroring PurchaseOrderList's
// renderPoBody pattern (same printInventoryDocument() shell). Includes the
// installment item/rebate breakdown when present so the printed document
// and the on-screen view never disagree on content.
function renderInvoiceBody(doc: PrintDocumentEnvelope): string {
  const inv = doc.document as Record<string, unknown>
  const customer = inv.customer as { name?: string } | undefined
  const installmentDetail = inv.installmentDetail as {
    termMonths: number | null
    rebate: number | string | null
    items: Record<string, unknown>[]
  } | null
  const fmt = (n: number) =>
    n.toLocaleString('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 2 })
  const fmtDateStr = (v: unknown) => (v ? new Date(v as string).toLocaleDateString('en-PH') : '—')
  const totalAmount = Number(inv.totalAmount ?? 0)
  const amountPaid = Number(inv.amountPaid ?? 0)
  const outstanding = totalAmount - amountPaid

  const itemsRows = (installmentDetail?.items ?? [])
    .map((l) => {
      const item = l.item as { name?: string; brand?: { name?: string } | null } | null
      const qty = Number(l.quantity ?? 0)
      const unitPrice = Number(l.unitPrice ?? 0)
      const lineTotal = Number(l.lineTotal ?? qty * unitPrice)
      const brand = item?.brand ? ` — ${item.brand.name}` : ''
      const serialNumber = l.serialNumber as { serialNumber?: string } | null
      const secondarySerialNumber = l.secondarySerialNumber as { serialNumber?: string } | null
      const serials = serialNumber
        ? `<div style="font-size:10px;color:#7c3aed">SN: ${serialNumber.serialNumber}${secondarySerialNumber ? ` / ${secondarySerialNumber.serialNumber}` : ''}</div>`
        : ''
      return `<tr><td>${item?.name ?? '—'}${brand}${serials}</td><td style="text-align:right">${qty}</td><td style="text-align:right">${fmt(unitPrice)}</td><td style="text-align:right">${fmt(lineTotal)}</td></tr>`
    })
    .join('')

  return `<h2>Invoice Details</h2><div class="meta">
    <div><p class="label">Customer</p><p>${customer?.name ?? '—'}</p></div>
    <div><p class="label">Invoice Date</p><p>${fmtDateStr(inv.invoiceDate)}</p></div>
    <div><p class="label">Due Date</p><p>${fmtDateStr(inv.dueDate)}</p></div>
    <div><p class="label">Status</p><p>${inv.status ?? '—'}</p></div>
  </div>
  ${
    installmentDetail
      ? `<h2>Items — ${installmentDetail.termMonths ?? '—'}-month installment</h2>
  <table><thead><tr><th>Item</th><th style="text-align:right">Qty</th><th style="text-align:right">Unit Price</th><th style="text-align:right">Line Total</th></tr></thead>
  <tbody>${itemsRows}</tbody></table>
  <p style="font-size:12px;color:#666;text-align:right;margin-top:4px">Rebate on this due date: ${fmt(Number(installmentDetail.rebate ?? 0))}</p>`
      : ''
  }
  <h2>Amount</h2>
  <table><tbody>
    <tr><td>Subtotal</td><td style="text-align:right">${fmt(Number(inv.subtotal ?? 0))}</td></tr>
    <tr><td>Tax</td><td style="text-align:right">${fmt(Number(inv.taxAmount ?? 0))}</td></tr>
    <tr><td><strong>Total</strong></td><td style="text-align:right"><strong>${fmt(totalAmount)}</strong></td></tr>
    <tr><td>Paid</td><td style="text-align:right">${fmt(amountPaid)}</td></tr>
    <tr><td><strong>Outstanding</strong></td><td style="text-align:right"><strong>${fmt(outstanding)}</strong></td></tr>
  </tbody></table>`
}

export default function ARInvoiceDetail({ id }: { id: string }) {
  const [invoice, setInvoice] = useState<ARInvoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    ARInvoices.get(id).then((res) => {
      if (res.success && res.data) setInvoice(res.data)
      else setError(res.error ?? 'Invoice not found')
      setLoading(false)
    })
  }, [id])

  async function handleDownload() {
    setDownloading(true)
    const res = await ARInvoices.getDocument(id)
    setDownloading(false)
    if (res.success && res.data) printInventoryDocument(res.data, 'AR Invoice', renderInvoiceBody)
  }

  if (loading) {
    return <div className="px-4 py-6 text-gray-400 sm:px-6 lg:px-10 lg:py-8">Loading invoice…</div>
  }

  if (error || !invoice) {
    return (
      <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <Link
          href="/accounting/ar-invoices"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500"
        >
          <ArrowLeft className="h-4 w-4" /> Back to AR Invoices
        </Link>
        <p className="text-red-600">{error ?? 'Not found'}</p>
      </div>
    )
  }

  const outstanding = invoice.totalAmount - invoice.amountPaid

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <Link
        href="/accounting/ar-invoices"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" /> Back to AR Invoices
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{invoice.invoiceNumber}</h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-gray-500">
            {invoice.customer?.name}
            <span className="rounded-full bg-purple-50 px-2 py-0.5 text-xs text-purple-700">
              {invoice.status}
            </span>
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

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-gray-200 bg-white p-5 lg:col-span-1">
          <h2 className="mb-3 text-[14px] font-semibold text-gray-900">Details</h2>
          <dl className="space-y-2 text-[13px]">
            <Row label="Invoice date" value={fmtDate(invoice.invoiceDate)} />
            <Row label="Due date" value={fmtDate(invoice.dueDate)} />
            <Row label="Subtotal" value={fmtMoney(invoice.subtotal)} />
            <Row label="Tax" value={fmtMoney(invoice.taxAmount)} />
            <Row label="Total" value={fmtMoney(invoice.totalAmount)} />
            <Row label="Paid" value={fmtMoney(invoice.amountPaid)} />
            <Row label="Outstanding" value={fmtMoney(outstanding)} bold />
          </dl>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5 lg:col-span-2">
          <h2 className="mb-3 text-[14px] font-semibold text-gray-900">
            {invoice.installmentDetail
              ? `Items — ${invoice.installmentDetail.termMonths ?? '—'}-month installment`
              : 'Items'}
          </h2>
          {!invoice.installmentDetail && (
            <p className="py-6 text-center text-[13px] text-gray-400">
              No item breakdown for this invoice.
            </p>
          )}
          {invoice.installmentDetail && (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100 text-sm">
                  <thead className="text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    <tr>
                      <th className="py-2 pr-4">Item</th>
                      <th className="py-2 pr-4 text-right">Qty</th>
                      <th className="py-2 pr-4 text-right">Unit price</th>
                      <th className="py-2 text-right">Line total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {invoice.installmentDetail.items.map((l) => (
                      <tr key={l.id}>
                        <td className="py-2 pr-4 text-gray-900">
                          {l.item?.name ?? '—'}
                          {l.item?.brand ? (
                            <span className="text-gray-500"> — {l.item.brand.name}</span>
                          ) : null}
                          {l.serialNumber && (
                            <p className="font-mono text-[10px] text-purple-500">
                              SN: {l.serialNumber.serialNumber}
                              {l.secondarySerialNumber &&
                                ` / ${l.secondarySerialNumber.serialNumber}`}
                            </p>
                          )}
                        </td>
                        <td className="py-2 pr-4 text-right">{l.quantity}</td>
                        <td className="py-2 pr-4 text-right">{fmtMoney(Number(l.unitPrice))}</td>
                        <td className="py-2 text-right">{fmtMoney(l.lineTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-right text-[13px] text-gray-600">
                Rebate on this due date:{' '}
                <span className="font-semibold">
                  {fmtMoney(Number(invoice.installmentDetail.rebate ?? 0))}
                </span>
              </p>
            </>
          )}
        </section>
      </div>

      <section className="mt-4 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-3 text-[14px] font-semibold text-gray-900">Payment history</h2>
        {(!invoice.payments || invoice.payments.length === 0) && (
          <p className="py-4 text-center text-[13px] text-gray-400">No payments recorded yet.</p>
        )}
        {invoice.payments && invoice.payments.length > 0 && (
          <ul className="divide-y divide-gray-100">
            {invoice.payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
                <div>
                  <div className="text-gray-800">
                    {fmtDate(p.paymentDate)}
                    {p.method ? ` · ${p.method}` : ''}
                    {p.reference ? ` · ${p.reference}` : ''}
                    {p.cancelledAt && (
                      <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500 ring-1 ring-inset ring-gray-200">
                        cancelled
                      </span>
                    )}
                  </div>
                </div>
                <span className="shrink-0 font-semibold tabular-nums text-gray-900">
                  {fmtMoney(p.amount + p.withholdingAmount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-gray-500">{label}</dt>
      <dd className={`text-right ${bold ? 'font-semibold' : 'font-medium'} text-gray-800`}>
        {value}
      </dd>
    </div>
  )
}
