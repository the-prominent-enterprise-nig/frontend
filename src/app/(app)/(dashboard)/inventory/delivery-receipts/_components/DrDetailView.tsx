'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import AttachmentsPanel from '@/src/components/common/AttachmentsPanel'
import { MONO } from '@/src/libs/design/plex'
import { DR_PURPOSE_CONFIG } from '@/src/libs/inventory/delivery-receipt-purposes'
import type { DrDetail } from '@/src/schema/inventory/delivery-receipts'
import { DR_STATUS_META, drStatusLabel, fmtDrDate, fmtPeso } from '../_lib/dr-format'
import { BTN_GHOST, DrShell, HeaderFigure, NumberChip, Section } from './drFormUi'
import { DrPrintButton } from './DrPrintButton'

const BACK_HREF = '/inventory/stock-transaction?tab=delivery-receipts'

/** Scenario 72 — a Delivery Receipt that is no longer a draft, read-only.
 * `actions` is where the approval step (Part 3) puts its buttons. */
export default function DrDetailView({
  dr,
  actions,
  memoHref,
}: {
  dr: DrDetail
  actions?: ReactNode
  /** The memo's page, for those who may open it (accounting). */
  memoHref?: string
}): React.JSX.Element {
  const config = DR_PURPOSE_CONFIG[dr.purpose]
  // Either kind: a return to supplier's is a supplier debit memo (Part 8).
  const memo = dr.debitMemo ?? dr.supplierDebitMemo
  return (
    <DrShell
      title="Delivery receipt"
      chip={
        <>
          <NumberChip>{dr.drNumber}</NumberChip>
          <span
            className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-medium ${DR_STATUS_META[dr.status].badge}`}
          >
            {drStatusLabel(dr.status, dr.purpose)}
          </span>
        </>
      }
      subtitle={`${config.label} · issued from ${dr.branch?.name ?? dr.warehouse.name} on ${fmtDrDate(dr.issueDate)}`}
      headerAside={<HeaderFigure label={costLabel(dr)} value={fmtPeso(drCost(dr))} />}
      status={statusLine(dr)}
      actions={
        <>
          <Link href={BACK_HREF} className={BTN_GHOST}>
            Back
          </Link>
          <DrPrintButton id={dr.id} hasMemo={!!memo} />
          {actions}
        </>
      }
    >
      {dr.status === 'rejected' && dr.rejectReason && (
        <div className="rounded-xl border border-[#f3c9c5] bg-[#fdeceb] px-4 py-3 text-[13px] text-[#8f1c14]">
          <strong>Rejected:</strong> {dr.rejectReason}
        </div>
      )}
      <Section title="Purpose">
        <p className="text-[14px] font-medium text-[#17171c]">
          {config.label}
          {dr.purposeDetail && (
            <span className="font-normal text-[#5b5b6b]"> — {dr.purposeDetail}</span>
          )}
        </p>
        <div className="rounded-lg bg-[#f1ebfb] px-3.5 py-3 text-[12.5px] leading-relaxed text-[#3f1490]">
          {config.effect}
        </div>
      </Section>
      <Section title="Issue details">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
          <Pair label="DR no." value={dr.drNumber} mono />
          {config.withDebitMemo && (
            <div>
              <dt className="text-[11.5px] text-[#8b8b9b]">Debit memo no.</dt>
              <dd className={`mt-0.5 text-[13px] ${MONO}`}>
                {memo && memoHref ? (
                  <Link href={memoHref} className="font-medium text-[#3f1490] hover:underline">
                    {memo.memoNumber}
                  </Link>
                ) : (
                  (memo?.memoNumber ?? 'Assigned on approval')
                )}
              </dd>
            </div>
          )}
          <Pair label="Issue date" value={fmtDrDate(dr.issueDate)} />
          <Pair label="Issuing branch" value={dr.branch?.name ?? dr.warehouse.name} />
          <Pair label="Department" value={dr.department?.name} />
          <Pair label="Delivered to" value={dr.deliveredTo} wide />
          <Pair label="Customer ID" value={dr.customerCode} mono />
          <Pair label="Contact no." value={dr.contactNo} />
          <Pair label="Address" value={dr.address} wide />
        </dl>
      </Section>
      <Section title="Reference and approval">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
          <Pair label="Reference no." value={dr.referenceNo} />
          <Pair
            label="Reference date"
            value={dr.referenceDate ? fmtDrDate(dr.referenceDate) : null}
          />
          <Pair label="Reason / details" value={dr.reason} wide />
          <Pair label="Submitted" value={dr.submittedAt ? fmtDrDate(dr.submittedAt) : null} />
          <Pair label="Approved" value={dr.approvedAt ? fmtDrDate(dr.approvedAt) : null} />
          {dr.uds && <Pair label="Repair ticket (UDS)" value={dr.uds.code} mono />}
          {dr.posTransaction && (
            <Pair label="Invoiced as" value={dr.posTransaction.transactionNumber} mono />
          )}
        </dl>
      </Section>
      <Section title="Items">
        <ItemsTable dr={dr} />
        {dr.remarks && (
          <p className="text-[12.5px] text-[#5b5b6b]">
            <span className="font-medium text-[#3d3d4a]">Remarks: </span>
            {dr.remarks}
          </p>
        )}
      </Section>
      <AttachmentsPanel entityType="DeliveryReceipt" entityId={dr.id} readOnly />
    </DrShell>
  )
}

function drCost(dr: DrDetail): number {
  return dr.lines.reduce((sum, l) => sum + l.quantity * (l.unitCost ?? l.estimatedUnitCost ?? 0), 0)
}

function costLabel(dr: DrDetail): string {
  return dr.lines.some((l) => l.unitCost == null) ? 'Estimated cost' : 'Cost'
}

/** One line in the action bar on where the DR stands and what comes next. */
function statusLine(dr: DrDetail): string {
  switch (dr.status) {
    case 'pending_approval':
      return 'Waiting for the Branch Manager. Nothing has moved yet.'
    case 'approved':
      return DR_PURPOSE_CONFIG[dr.purpose].withDebitMemo
        ? 'Approved — the debit memo posts with the approval.'
        : 'Approved.'
    case 'posted':
      return 'Posted — the stock has left the issuing branch.'
    case 'invoiced':
      return 'Invoiced at POS.'
    case 'rejected':
      return 'Rejected — nothing moved.'
    case 'voided':
      return 'Voided — anything it posted has been reversed.'
    default:
      return ''
  }
}

function Pair({
  label,
  value,
  mono,
  wide,
}: {
  label: string
  value: string | null | undefined
  mono?: boolean
  wide?: boolean
}): React.JSX.Element {
  return (
    <div className={wide ? 'sm:col-span-2' : ''}>
      <dt className="text-[11.5px] text-[#8b8b9b]">{label}</dt>
      <dd className={`mt-0.5 text-[13px] text-[#17171c] ${mono ? MONO : ''}`}>{value || '—'}</dd>
    </div>
  )
}

function ItemsTable({ dr }: { dr: DrDetail }): React.JSX.Element {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-[13px]">
        <thead className="border-b border-[#eeeef1] text-[11px] uppercase tracking-[.06em] text-[#8b8b9b]">
          <tr>
            <th className="py-2 pr-3 font-medium">Model</th>
            <th className="py-2 pr-3 font-medium">Brand</th>
            <th className="py-2 pr-3 font-medium">Serial no.</th>
            <th className="py-2 pr-3 text-right font-medium">Qty</th>
            <th className="py-2 text-right font-medium">Unit cost</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#eeeef1]">
          {dr.lines.map((l) => (
            <tr key={l.id}>
              <td className="py-2.5 pr-3">
                {l.item.name}
                {l.item.modelNumber && (
                  <span className="block text-[11px] text-[#8b8b9b]">{l.item.modelNumber}</span>
                )}
              </td>
              <td className="py-2.5 pr-3 text-[#5b5b6b]">{l.item.brand?.name ?? '—'}</td>
              <td className={`py-2.5 pr-3 ${MONO}`}>{l.serialNumber?.serialNumber ?? '—'}</td>
              <td className="py-2.5 pr-3 text-right tabular-nums">{l.quantity}</td>
              <td className="py-2.5 text-right tabular-nums">
                {fmtPeso(l.unitCost ?? l.estimatedUnitCost ?? 0)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
