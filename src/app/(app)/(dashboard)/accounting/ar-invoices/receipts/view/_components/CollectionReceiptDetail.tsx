'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft, Download, Loader2 } from 'lucide-react'
import { ARInvoices, fmtMoney, fmtDate } from '@/src/libs/data/AccountingV2Data'
import { printCollectionReceiptDocument } from '@/src/libs/print/printInventoryDocument'
import {
  CollectionReceiptDocumentSheet,
  type CollectionReceiptDocument,
} from '../../../_components/CollectionReceiptSheet'

/** A receipt is addressed by the (invoice, payment) pairs it applied to —
 * one for an ordinary receipt, several for a bulk/overflow payment that
 * settled more than one due. There's no single-receipt document endpoint on
 * the backend, so the pairs travel in the URL and each one's existing
 * document is fetched and combined here, exactly as the Receipts list used
 * to do before printing. */
function parseApplications(raw: string | null): { invoiceId: string; paymentId: string }[] {
  return (raw ?? '')
    .split(',')
    .filter(Boolean)
    .map((pair) => pair.split(':'))
    .filter((parts) => parts.length === 2 && parts[0] && parts[1])
    .map(([invoiceId, paymentId]) => ({ invoiceId, paymentId }))
}

/** Builds the same URL this page reads, so callers don't hand-roll it. */
export function collectionReceiptHref(
  applications: { arInvoiceId: string; paymentId: string }[]
): string {
  const apps = applications.map((a) => `${a.arInvoiceId}:${a.paymentId}`).join(',')
  return `/accounting/ar-invoices/receipts/view?apps=${encodeURIComponent(apps)}`
}

function CollectionReceiptDetailBody() {
  const searchParams = useSearchParams()
  const apps = parseApplications(searchParams.get('apps'))
  const appsKey = apps.map((a) => `${a.invoiceId}:${a.paymentId}`).join(',')

  const [doc, setDoc] = useState<CollectionReceiptDocument | null>(null)
  const [dueCount, setDueCount] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const applications = parseApplications(appsKey)
    if (applications.length === 0) {
      setError('No receipt specified.')
      setLoading(false)
      return
    }
    let cancelled = false
    Promise.all(
      applications.map((a) => ARInvoices.getReceiptDocument(a.invoiceId, a.paymentId))
    ).then((results) => {
      if (cancelled) return
      const docs = results
        .filter((res) => res.success && res.data)
        .map((res) => res.data as CollectionReceiptDocument)
      if (docs.length === 0) {
        setError('Could not load this receipt.')
        setLoading(false)
        return
      }
      setDueCount(docs.length)
      if (docs.length === 1) {
        setDoc(docs[0])
      } else {
        // One payment action across several dues — one row per due plus a
        // combined total, rather than collapsing into one misleadingly
        // labeled account line.
        const first = docs[0].document
        setDoc({
          documentType: docs[0].documentType,
          documentNumber: docs[0].documentNumber,
          generatedAt: new Date().toISOString(),
          enterprise: docs[0].enterprise,
          document: {
            paymentDate: first.paymentDate,
            reference: first.reference,
            amount: docs.reduce((sum, d) => sum + d.document.amount, 0),
            description: `Payment across ${docs.length} installment dues`,
            customer: first.customer,
            lines: docs.map((d) => ({
              accountLine: `Accounts Receivable — ${first.customer.name} — ${d.document.invoiceNumber ?? '—'}`,
              amount: d.document.amount,
            })),
          },
        })
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [appsKey])

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-6 text-gray-400 sm:px-6 lg:px-8">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading receipt…
      </div>
    )
  }

  if (error || !doc) {
    return (
      <div className="px-4 py-6 sm:px-6 lg:px-8">
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

  const receipt = doc.document

  return (
    <div className="px-4 py-4 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/accounting/ar-invoices"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
        >
          <ArrowLeft className="h-4 w-4" /> Back to AR Invoices
        </Link>
        <button
          onClick={() => printCollectionReceiptDocument(doc)}
          className="inline-flex items-center gap-1.5 rounded-md bg-prominent-orange-600 px-3 py-1.5 text-[13px] font-semibold text-white shadow-sm hover:bg-prominent-orange-700"
        >
          <Download className="h-4 w-4" />
          Print / Download
        </button>
      </div>

      {/* Record data the paper document doesn't carry — kept outside the sheet
          so the sheet itself stays a faithful preview of what prints. */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-gray-500">
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
          RECEIVED
        </span>
        <span>Receipt {doc.documentNumber}</span>
        <span>{fmtDate(receipt.paymentDate)}</span>
        <span>Amount {fmtMoney(receipt.amount)}</span>
        {dueCount > 1 && <span>Settled {dueCount} dues</span>}
      </div>

      <div className="mt-2.5">
        <CollectionReceiptDocumentSheet doc={doc} />
      </div>
    </div>
  )
}

export default function CollectionReceiptDetail() {
  // useSearchParams() needs a Suspense boundary to keep this route from
  // opting the whole segment out of static rendering.
  return (
    <Suspense
      fallback={
        <div className="flex items-center gap-2 px-4 py-6 text-gray-400 sm:px-6 lg:px-8">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading receipt…
        </div>
      }
    >
      <CollectionReceiptDetailBody />
    </Suspense>
  )
}
