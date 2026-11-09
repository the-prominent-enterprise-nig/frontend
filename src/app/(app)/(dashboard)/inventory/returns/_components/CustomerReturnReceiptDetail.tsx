'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Loader2, Printer } from 'lucide-react'
import { DocumentUnavailable } from '@/src/components/inventory/DocumentUnavailable'
import { describeDocumentError } from '@/src/libs/data/document-errors'
import { printReceivingReportDocument } from '@/src/libs/print/printInventoryDocument'
import ReceivingReportSheet, {
  type ReceivingReportDocument,
} from '../../../accounting/receiving-reports/_components/ReceivingReportSheet'
import { getCustomerReturnDocument } from '../_actions/get-customer-return-document'

type Props = {
  id: string
  /** Inventory and Accounting both list receiving reports; the back link
   * returns to whichever one the reader came from. */
  backHref?: string
  backLabel?: string
}

type ReturnLine = {
  id: string
  quantity: number | string
  serialNumber?: string | null
  item?: ReceivingReportDocument['document']['lines'] extends (infer L)[] | undefined
    ? L extends { item?: infer I }
      ? I
      : never
    : never
}

type ReturnEnvelope = {
  documentNumber: string | null
  generatedAt: string
  enterprise?: ReceivingReportDocument['enterprise']
  document: {
    id: string
    receivingReportNumber?: string | null
    occurredAt: string
    salesInvoiceNumber?: string | null
    salesInvoiceDate?: string | null
    customer?: { name?: string | null; customerCode?: string | null } | null
    warehouse?: ReceivingReportDocument['document']['warehouse']
    lines?: ReturnLine[]
  }
}

/**
 * A posted customer return as an RR document (reason `customer_return`), so
 * it renders and prints through the same ReceivingReportSheet and RR print a
 * Repair receipt uses: "RETURN" under the title, the customer as the party,
 * Invoice No. / Date, the branch line, Brand / Subgroup / Model. Prices are
 * left off — like a Repair RR, the paper states quantities only.
 */
function toReceivingReportDocument(env: ReturnEnvelope): ReceivingReportDocument {
  const ret = env.document
  const invoice = ret.salesInvoiceNumber?.trim()
  return {
    documentType: 'customer_return',
    documentNumber: env.documentNumber ?? ret.receivingReportNumber ?? null,
    generatedAt: env.generatedAt,
    enterprise: env.enterprise,
    document: {
      id: ret.id,
      code: env.documentNumber ?? ret.receivingReportNumber ?? '',
      receivedAt: ret.occurredAt,
      reason: 'customer_return',
      returnedBy: ret.customer ?? null,
      returnedInvoices: invoice ? [{ number: invoice, date: ret.salesInvoiceDate ?? null }] : [],
      warehouse: ret.warehouse,
      lines: (ret.lines ?? []).map((l) => ({
        id: l.id,
        quantityReceived: l.quantity,
        serialNumbers: l.serialNumber ? [l.serialNumber] : [],
        item: l.item,
      })),
    },
  }
}

function BackLink({ href, label }: { href: string; label: string }): ReactNode {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
    >
      <ArrowLeft className="h-4 w-4" /> {label}
    </Link>
  )
}

/**
 * The RRC receiving report of a posted customer return (ticket #27), opened
 * from a Return row in Receiving Reports the way any other row opens its RR.
 */
export function CustomerReturnReceiptDetail({
  id,
  backHref = '/inventory/stock-transaction?tab=receiving',
  backLabel = 'Back',
}: Props): ReactNode {
  const query = useQuery({
    queryKey: ['customer-return-document', id],
    queryFn: () => getCustomerReturnDocument(id),
  })

  if (query.isLoading) {
    return (
      <div className="flex items-center gap-2 px-4 py-6 text-gray-400 sm:px-6 lg:px-8">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading receiving report…
      </div>
    )
  }

  const envelope = query.data?.success ? (query.data.data as ReturnEnvelope | undefined) : null
  if (!envelope) {
    const error = query.data?.error ?? query.error?.message ?? 'Receiving report not found'
    return (
      <div className="px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-4">
          <BackLink href={backHref} label={backLabel} />
        </div>
        <DocumentUnavailable {...describeDocumentError(error, 'receiving report')} />
      </div>
    )
  }

  const doc = toReceivingReportDocument(envelope)
  return (
    <div className="px-4 py-4 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <BackLink href={backHref} label={backLabel} />
        <button
          type="button"
          onClick={() => printReceivingReportDocument(doc, { showPrices: false })}
          className="inline-flex items-center gap-1.5 rounded-md bg-prominent-orange-600 px-3 py-1.5 text-[13px] font-semibold text-white shadow-sm hover:bg-prominent-orange-700"
        >
          <Printer className="h-4 w-4" /> Print
        </button>
      </div>
      <div className="mt-2.5">
        <ReceivingReportSheet doc={doc} showPrices={false} />
      </div>
    </div>
  )
}
