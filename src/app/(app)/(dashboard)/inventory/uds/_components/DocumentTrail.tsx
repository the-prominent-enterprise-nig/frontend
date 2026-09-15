'use client'

import Link from 'next/link'
import { FileText, Truck, Wrench, PackageCheck, HandCoins, ReceiptText } from 'lucide-react'
import type { Uds } from '@/src/schema/inventory/uds'

/** One leg of the paper trail: the document handed over at that hop, who it
 *  went to, and when. `number` null means the leg has not happened yet — or,
 *  for a leg already behind the unit, that nobody recorded the document. */
export type TrailLeg = {
  key: string
  label: string
  hint: string
  number: string | null
  at: string | null
  href?: string
  icon: React.ElementType
  /** Set where we positively know the hop happened even with no document
   *  number against it — the SI is optional, the handover is not. Lets the
   *  trail say "moved, but nobody recorded the paper", which is a finding,
   *  rather than showing the leg as still pending, which is wrong. */
  occurred?: boolean
}

/**
 * The unit's journey in the order it physically runs:
 *
 *   customer → branch → main → service provider → main → branch → customer
 *
 * Every number here is free text off a real document someone signed, not a
 * link to a record in this system — the unit may have been sold on paper or
 * repaired by a provider who keeps their own books. The one hard link is the
 * branch→main StockTransfer, and it appears only on our own units: that hop
 * moves stock between our warehouses, which a customer's unit never does.
 *
 * The customer legs appear only on a custodial UDS. An internal pull-out or
 * loan has no customer, no SI to trace back to and nothing to hand back, so
 * showing those rows empty would read as three missing documents rather than
 * three legs that never applied.
 */
export function udsDocumentTrail(uds: Uds): TrailLeg[] {
  const isCustodial = !!uds.customerId

  const customerIntake: TrailLeg[] = [
    {
      key: 'si',
      label: "Customer's SI",
      hint: 'Proof of purchase shown at intake',
      number: uds.intakeSalesInvoiceNumber ?? null,
      at: null,
      icon: ReceiptText,
    },
    {
      key: 'intake-rr',
      label: 'RR issued to customer',
      hint: 'What the customer walks away holding',
      number: uds.intakeReceivingReportNumber ?? null,
      at: uds.createdAt,
      icon: FileText,
    },
  ]

  // A custodial unit is the customer's property, so no StockTransfer is ever
  // raised for it — autoPairRepairTransfer() runs on the manual Create UDS
  // path only, never on an intake from a return. Listing the leg anyway would
  // show a permanently empty row on exactly the sheets that can never fill it,
  // and imply a movement record that must not exist. On those sheets the SI
  // below is the whole record of that hop.
  const stockTransfer: TrailLeg[] = isCustodial
    ? []
    : [
        {
          key: 'transfer',
          label: 'Branch → Main (stock transfer)',
          hint: 'The movement of the unit between our own warehouses',
          number: uds.linkedStockTransfer?.transferNumber ?? null,
          at: null,
          href: uds.linkedStockTransfer ? '/inventory/transfers' : undefined,
          icon: Truck,
        },
      ]

  const middle: TrailLeg[] = [
    ...stockTransfer,
    {
      key: 'out-custody',
      label: 'Custody transfer to main',
      hint: 'The gate pass the unit travels on',
      number: uds.transferToMainCustodyNumber ?? null,
      at: uds.transferredToMainAt ?? null,
      occurred: !!uds.transferredToMainAt,
      icon: Truck,
    },
    {
      key: 'out-si',
      label: 'SI to main',
      hint: 'Raised by the branch alongside the handover',
      number: uds.transferToMainSalesInvoiceNumber ?? null,
      at: uds.transferredToMainAt ?? null,
      occurred: !!uds.transferredToMainAt,
      icon: ReceiptText,
    },
    {
      key: 'dispatch-dr',
      label: 'DR to service provider',
      hint: 'Handed out with the unit',
      number: uds.dispatchDeliveryReceiptNumber ?? null,
      at: uds.dispatchedAt ?? null,
      icon: Wrench,
    },
    {
      key: 'return-rr',
      label: 'RR from service provider',
      hint: 'Raised when the unit comes back',
      number: uds.returnReceivingReportNumber ?? null,
      at: uds.returnedAt ?? null,
      icon: PackageCheck,
    },
    {
      key: 'back-custody',
      label: 'Custody transfer to branch',
      hint: 'The gate pass the unit comes home on',
      number: uds.returnToBranchCustodyNumber ?? null,
      at: uds.returnedToBranchAt ?? null,
      occurred: !!uds.returnedToBranchAt,
      icon: Truck,
    },
    {
      key: 'back-si',
      label: 'SI back to branch',
      hint: 'Raised when the unit returns to the branch',
      number: uds.returnToBranchSalesInvoiceNumber ?? null,
      at: uds.returnedToBranchAt ?? null,
      occurred: !!uds.returnedToBranchAt,
      icon: ReceiptText,
    },
  ]

  const release: TrailLeg[] = [
    {
      key: 'release-dr',
      label: 'DR to customer',
      hint: 'Signed when the unit is handed back',
      number: uds.releaseDeliveryReceiptNumber ?? null,
      at: uds.releasedAt ?? null,
      icon: HandCoins,
    },
  ]

  return isCustodial ? [...customerIntake, ...middle, ...release] : middle
}

/** The furthest document actually recorded — where the unit has got to on
 *  paper, which is not always where its status says it is. */
export function latestTrailLeg(uds: Uds): TrailLeg | null {
  const recorded = udsDocumentTrail(uds).filter((leg) => leg.number)
  return recorded.length ? recorded[recorded.length - 1] : null
}

function formatDate(iso?: string | null): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export default function DocumentTrail({ uds }: { uds: Uds }): React.ReactElement {
  const legs = udsDocumentTrail(uds)
  const recorded = legs.filter((leg) => leg.number).length

  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <p className="text-sm font-medium text-zinc-700">Document trail</p>
        <p className="text-xs text-zinc-400">
          {recorded} of {legs.length} recorded
        </p>
      </div>
      <ol className="space-y-0">
        {legs.map((leg, i) => (
          <TrailRow key={leg.key} leg={leg} isLast={i === legs.length - 1} />
        ))}
      </ol>
    </div>
  )
}

function TrailRow({ leg, isLast }: { leg: TrailLeg; isLast: boolean }): React.ReactElement {
  const done = !!leg.number
  // A leg that happened without its document is neither done nor pending: the
  // unit moved, and the paper that should have travelled with it is missing.
  const undocumented = !leg.number && !!leg.occurred
  const Icon = leg.icon
  const date = formatDate(leg.at)

  return (
    <li className="flex gap-3">
      {/* Rail: the dot for this leg plus the line down to the next one, so the
          trail reads as one journey rather than six unrelated fields. */}
      <div className="flex flex-col items-center">
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
            done
              ? 'border-prominent-purple-700 bg-prominent-purple-700 text-white'
              : undocumented
                ? 'border-amber-400 bg-amber-50 text-amber-600'
                : 'border-dashed border-zinc-300 bg-white text-zinc-300'
          }`}
        >
          <Icon className="h-3 w-3" />
        </span>
        {!isLast && <span className="w-px flex-1 bg-zinc-200" aria-hidden />}
      </div>

      <div className={`min-w-0 flex-1 ${isLast ? 'pb-0' : 'pb-4'}`}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <p
            className={`text-sm ${
              done || undocumented ? 'font-medium text-zinc-800' : 'text-zinc-400'
            }`}
          >
            {leg.label}
          </p>
          {date && <p className="text-xs text-zinc-400">{date}</p>}
        </div>
        {leg.number ? (
          leg.href ? (
            <Link
              href={leg.href}
              className="font-mono text-xs text-prominent-purple-700 hover:underline"
            >
              {leg.number}
            </Link>
          ) : (
            <p className="font-mono text-xs text-zinc-600">{leg.number}</p>
          )
        ) : undocumented ? (
          <p className="text-xs text-amber-700">Handed over — no document number recorded</p>
        ) : (
          <p className="text-xs text-zinc-400">{leg.hint}</p>
        )}
      </div>
    </li>
  )
}
