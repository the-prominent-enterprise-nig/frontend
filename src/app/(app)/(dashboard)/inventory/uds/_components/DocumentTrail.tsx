'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, Truck, Wrench, PackageCheck, HandCoins, ReceiptText } from 'lucide-react'
import type { Uds, UdsStatus } from '@/src/schema/inventory/uds'

/**
 * What an empty document means. `missing` is the only one anybody has to act
 * on — the same three-tone split the returns Paperwork card uses, and for the
 * same reason: a DR that was never going to exist and a DR that should have
 * travelled with the unit are the same empty field and two different facts.
 */
export type TrailTone = 'filled' | 'missing' | 'pending'

/** One piece of paper: the number on it, and when the hop it belongs to
 *  happened. */
export type TrailDoc = {
  key: string
  label: string
  number: string | null
  at: string | null
  href?: string
  tone: TrailTone
}

/** One physical hop of the journey, and every document handed over at it.
 *  A hop is the unit of the display; the documents are its detail. */
export type TrailHop = {
  key: string
  label: string
  icon: React.ElementType
  at: string | null
  docs: TrailDoc[]
  tone: TrailTone
}

type DocSpec = Omit<TrailDoc, 'tone'> & {
  /** The status from which this document should already be in hand. Omitted
   *  where the document is genuinely optional — the customer's own SI is shown
   *  at intake if they brought it, and is nobody's to chase if they did not. */
  dueFrom?: UdsStatus
}

type HopSpec = Omit<TrailHop, 'docs' | 'tone' | 'at'> & { docs: DocSpec[] }

// How far along the journey each status is. `cancelled` sits outside the
// sequence: a sheet nobody is pursuing has no outstanding paperwork.
const STATUS_RANK: Record<UdsStatus, number> = {
  issued: 0,
  in_transit: 1,
  received: 2,
  at_provider: 3,
  repaired: 4,
  completed: 5,
  cancelled: -1,
}

/**
 * A document is overdue once the unit is past the hop it belongs to, or once a
 * timestamp proves the hop happened — the unit moved, and the paper that
 * should have travelled with it is not here.
 */
function resolveDoc(spec: DocSpec, status: UdsStatus): TrailDoc {
  const { dueFrom, ...doc } = spec
  if (doc.number) return { ...doc, tone: 'filled' }
  if (status === 'cancelled') return { ...doc, tone: 'pending' }
  const due = !!doc.at || (dueFrom !== undefined && STATUS_RANK[status] >= STATUS_RANK[dueFrom])
  return { ...doc, tone: due ? 'missing' : 'pending' }
}

/** A hop is only as good as its worst document: one paper missing is a hop
 *  somebody has to go and chase, however many of the others came in. */
function resolveHop(spec: HopSpec, status: UdsStatus): TrailHop {
  const docs = spec.docs.map((d) => resolveDoc(d, status))
  const tone: TrailTone = docs.some((d) => d.tone === 'missing')
    ? 'missing'
    : docs.some((d) => d.tone === 'filled')
      ? 'filled'
      : 'pending'
  return { ...spec, docs, tone, at: docs.find((d) => d.at)?.at ?? null }
}

/**
 * The unit's journey in the order it physically runs:
 *
 *   customer → branch → main → service provider → main → branch → customer
 *
 * Grouped by hop rather than listed one document per row. The paperwork comes
 * in pairs and triples at a single handover — a gate pass and an SI leave the
 * branch together — and six rows of near-identical labels read as six separate
 * events rather than the three movements they record.
 *
 * Every number here is free text off a real document someone signed, not a
 * link to a record in this system — the unit may have been sold on paper or
 * repaired by a provider who keeps their own books. The one hard link is the
 * branch→main StockTransfer, and it appears only on our own units: that hop
 * moves stock between our warehouses, which a customer's unit never does.
 *
 * The customer hops appear only on a custodial UDS. An internal pull-out or
 * loan has no customer, no SI to trace back to and nothing to hand back, so
 * showing those rows empty would read as missing documents rather than hops
 * that never applied.
 */
export function udsDocumentTrail(uds: Uds): TrailHop[] {
  const isCustodial = !!uds.customerId

  // A custodial unit is the customer's property, so no StockTransfer is ever
  // raised for it — autoPairRepairTransfer() runs on the manual Create UDS
  // path only, never on an intake from a return. Listing it anyway would show
  // a permanently empty document on exactly the sheets that can never fill it,
  // and imply a movement record that must not exist.
  const transferDoc: DocSpec[] = isCustodial
    ? []
    : [
        {
          key: 'transfer',
          label: 'Stock transfer',
          number: uds.linkedStockTransfer?.transferNumber ?? null,
          at: null,
          href: uds.linkedStockTransfer ? '/inventory/transfers' : undefined,
          dueFrom: 'in_transit',
        },
      ]

  const intake: HopSpec[] = isCustodial
    ? [
        {
          key: 'intake',
          label: 'Customer to branch',
          icon: ReceiptText,
          docs: [
            {
              key: 'si',
              label: 'Customer SI',
              number: uds.intakeSalesInvoiceNumber ?? null,
              at: null,
            },
            {
              key: 'intake-rr',
              label: 'RR',
              number: uds.intakeReceivingReportNumber ?? null,
              at: uds.createdAt,
            },
          ],
        },
      ]
    : []

  const release: HopSpec[] = isCustodial
    ? [
        {
          key: 'release',
          label: 'Branch to customer',
          icon: HandCoins,
          docs: [
            {
              key: 'release-dr',
              label: 'DR',
              number: uds.releaseDeliveryReceiptNumber ?? null,
              at: uds.releasedAt ?? null,
              dueFrom: 'completed',
            },
          ],
        },
      ]
    : []

  const specs: HopSpec[] = [
    ...intake,
    {
      key: 'to-main',
      label: 'Branch to main',
      icon: Truck,
      docs: [
        ...transferDoc,
        {
          key: 'out-custody',
          label: 'Gate pass',
          number: uds.transferToMainCustodyNumber ?? null,
          at: uds.transferredToMainAt ?? null,
          dueFrom: 'in_transit',
        },
        {
          key: 'out-si',
          label: 'SI',
          number: uds.transferToMainSalesInvoiceNumber ?? null,
          at: uds.transferredToMainAt ?? null,
          dueFrom: 'in_transit',
        },
      ],
    },
    {
      key: 'to-provider',
      label: 'Main to provider',
      icon: Wrench,
      docs: [
        {
          key: 'dispatch-dr',
          label: 'DR',
          number: uds.dispatchDeliveryReceiptNumber ?? null,
          at: uds.dispatchedAt ?? null,
          dueFrom: 'at_provider',
        },
      ],
    },
    {
      key: 'from-provider',
      label: 'Provider to main',
      icon: PackageCheck,
      docs: [
        {
          key: 'return-rr',
          label: 'RR',
          number: uds.returnReceivingReportNumber ?? null,
          at: uds.returnedAt ?? null,
          dueFrom: 'repaired',
        },
      ],
    },
    {
      key: 'to-branch',
      label: 'Main to branch',
      icon: Truck,
      docs: [
        {
          key: 'back-custody',
          label: 'Gate pass',
          number: uds.returnToBranchCustodyNumber ?? null,
          at: uds.returnedToBranchAt ?? null,
          dueFrom: 'completed',
        },
        {
          key: 'back-si',
          label: 'SI',
          number: uds.returnToBranchSalesInvoiceNumber ?? null,
          at: uds.returnedToBranchAt ?? null,
          dueFrom: 'completed',
        },
      ],
    },
    ...release,
  ]

  return specs.map((spec) => resolveHop(spec, uds.status))
}

/** Every document on the trail, flat and in journey order. The counts below
 *  are per document, not per hop: what a clerk chases is pieces of paper. */
function trailDocuments(uds: Uds): TrailDoc[] {
  return udsDocumentTrail(uds).flatMap((hop) => hop.docs)
}

/** The furthest document actually recorded — where the unit has got to on
 *  paper, which is not always where its status says it is. */
export function latestTrailLeg(uds: Uds): TrailDoc | null {
  const recorded = trailDocuments(uds).filter((doc) => doc.number)
  return recorded.length ? recorded[recorded.length - 1] : null
}

/** How many documents somebody still has to go and get. Documents the unit has
 *  not reached yet are not shortfalls, and are not counted. */
export function outstandingTrailCount(uds: Uds): number {
  return trailDocuments(uds).filter((doc) => doc.tone === 'missing').length
}

function formatDate(iso?: string | null): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/** Where the recorded journey stops: everything past it is road the unit has
 *  not travelled, and is hidden until asked for. A hop still waiting in the
 *  middle stays visible, because there it is a gap and not a future. */
function splitAtFrontier(hops: TrailHop[]): { walked: TrailHop[]; ahead: TrailHop[] } {
  const frontier = hops.map((h) => h.tone !== 'pending').lastIndexOf(true)
  const cut = frontier === -1 ? 1 : frontier + 1
  return { walked: hops.slice(0, cut), ahead: hops.slice(cut) }
}

export default function DocumentTrail({ uds }: { uds: Uds }): React.ReactElement {
  const [showAhead, setShowAhead] = useState(false)
  const hops = udsDocumentTrail(uds)
  const outstanding = outstandingTrailCount(uds)
  const { walked, ahead } = splitAtFrontier(hops)
  const shown = showAhead ? hops : walked

  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <p className="text-sm font-medium text-zinc-700">Document trail</p>
        <span
          className={`rounded px-2 py-0.5 text-[11px] font-medium ${
            outstanding ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'
          }`}
        >
          {outstanding ? `${outstanding} outstanding` : 'Complete'}
        </span>
      </div>

      <ol className="space-y-0">
        {shown.map((hop, i) => (
          <HopRow key={hop.key} hop={hop} isLast={i === shown.length - 1 && !ahead.length} />
        ))}
      </ol>

      {ahead.length > 0 && (
        <button
          type="button"
          onClick={() => setShowAhead((v) => !v)}
          className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-700"
        >
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform ${showAhead && 'rotate-180'}`}
          />
          {showAhead
            ? 'Hide what is still ahead'
            : `${ahead.length} step${ahead.length !== 1 ? 's' : ''} ahead`}
        </button>
      )}
    </div>
  )
}

const DOT: Record<TrailTone, string> = {
  filled: 'border-prominent-purple-700 bg-prominent-purple-700 text-white',
  missing: 'border-amber-400 bg-amber-50 text-amber-600',
  pending: 'border-dashed border-zinc-300 bg-white text-zinc-300',
}

function HopRow({ hop, isLast }: { hop: TrailHop; isLast: boolean }): React.ReactElement {
  const Icon = hop.icon
  const date = formatDate(hop.at)
  // A document the unit has not reached yet says nothing the hop's own dot has
  // not already said, so only what is in hand or overdue gets a line.
  const docs = hop.docs.filter((doc) => doc.tone !== 'pending')

  return (
    <li className="flex gap-3">
      {/* Rail: the dot for this hop plus the line down to the next one, so the
          trail reads as one journey rather than a stack of unrelated fields. */}
      <div className="flex flex-col items-center">
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${DOT[hop.tone]}`}
        >
          <Icon className="h-3 w-3" />
        </span>
        {!isLast && <span className="w-px flex-1 bg-zinc-200" aria-hidden />}
      </div>

      <div className={`min-w-0 flex-1 ${isLast ? 'pb-0' : 'pb-3'}`}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <p
            className={`text-sm ${hop.tone === 'pending' ? 'text-zinc-400' : 'font-medium text-zinc-800'}`}
          >
            {hop.label}
          </p>
          {date && <p className="text-xs text-zinc-400">{date}</p>}
        </div>
        {docs.length > 0 && (
          <div className="mt-0.5 flex flex-wrap items-baseline gap-x-4 gap-y-0.5">
            {docs.map((doc) => (
              <DocChip key={doc.key} doc={doc} />
            ))}
          </div>
        )}
      </div>
    </li>
  )
}

function DocChip({ doc }: { doc: TrailDoc }): React.ReactElement {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-[11px] text-zinc-400">{doc.label}</span>
      {doc.number ? (
        doc.href ? (
          <Link
            href={doc.href}
            className="font-mono text-xs text-prominent-purple-700 hover:underline"
          >
            {doc.number}
          </Link>
        ) : (
          <span className="font-mono text-xs text-zinc-600">{doc.number}</span>
        )
      ) : (
        <span className="text-xs text-amber-700">Not recorded</span>
      )}
    </span>
  )
}
