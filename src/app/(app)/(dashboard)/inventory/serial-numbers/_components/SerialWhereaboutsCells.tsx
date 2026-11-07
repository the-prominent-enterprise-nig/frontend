/* The General Stockbook's Location and Destination cells: where a unit is,
 * and where it is going — a branch, a service center, a transfer, a DR's
 * recipient, a buyer, or whatever is holding it. */

import type { SerialNumberSummary } from '@/src/schema/inventory/serial-numbers'
import { UDS_REASON_LABELS, type UdsReason } from '@/src/schema/inventory/uds'
import { DR_PURPOSE_CONFIG } from '@/src/libs/inventory/delivery-receipt-purposes'
import type { DrPurpose } from '@/src/schema/inventory/delivery-receipts'
import { locationLabel } from '@/src/libs/format/locationLabel'
import { soldDestination } from '@/src/libs/format/serial-provenance'
import { formatShortDate } from '@/src/libs/format/date'
import { MONO } from '../../purchase-orders/_components/procurementTokens'

type Serial = SerialNumberSummary
type Lines = { name: string; tag?: string; reference?: string | null; date?: string | null }

const POSTED_DR = ['posted', 'invoiced']

const HOLD_LABELS: Record<NonNullable<Serial['heldBy']>['kind'], string> = {
  delivery_receipt: 'Delivery receipt',
  pos_release: 'POS release form',
  service_job: 'Service job',
}

/** Name / reference / date, the three lines every location cell shows. */
function CellLines({ name, tag, reference, date }: Lines): React.JSX.Element {
  return (
    <>
      <div className="font-medium text-[#17171c]">
        {name}
        {tag && <span className="ml-1.5 text-[11.5px] font-normal text-ink-muted">· {tag}</span>}
      </div>
      <div className={`${MONO} whitespace-nowrap text-[12.5px] text-[#5b21b6]`}>
        {reference ?? '—'}
      </div>
      <div className="text-[12.5px] text-ink-muted">{date ? formatShortDate(date) : '—'}</div>
    </>
  )
}

function purposeLabel(purpose: string): string {
  return DR_PURPOSE_CONFIG[purpose as DrPurpose]?.label ?? 'Delivery receipt'
}

function reasonLabel(reason: string | undefined): string {
  return UDS_REASON_LABELS[reason as UdsReason] ?? 'Repair'
}

/** Out for repair: it is at the service center, on the DR it left on. */
export function ServiceCenterLocation({ serial }: { serial: Serial }): React.JSX.Element {
  const ticket = serial.repairTicket
  return (
    <CellLines
      name={serial.consignedToSupplier?.name ?? 'Service center'}
      tag="Service center"
      reference={ticket?.dispatchDeliveryReceiptNumber ?? ticket?.code}
      date={ticket?.dispatchedAt}
    />
  )
}

/** What the location's name alone does not say: lost, written off, a
 * customer's unit, or out on a pull-out / loan / repair ticket. */
function locationNote(serial: Serial): string | null {
  if (serial.status === 'lost_in_transit') {
    const tr = serial.lostOnTransfer?.transferNumber
    return tr ? `Lost on ${tr}` : 'Lost in transit'
  }
  if (serial.status === 'scrapped') return 'Scrapped'
  if (serial.status === 'defective') return 'Defective'
  const ticket = serial.repairTicket
  if (!ticket) return null
  const owner = ticket.customerName ? `${ticket.customerName}'s unit · ` : ''
  return `${owner}${reasonLabel(ticket.reason)} · ${ticket.code}`
}

export function LocationNote({ serial }: { serial: Serial }): React.JSX.Element | null {
  const note = locationNote(serial)
  if (!note) return null
  const lost = serial.status === 'lost_in_transit'
  return (
    <span
      className={`ml-1.5 text-[11.5px] font-normal ${lost ? 'text-red-700' : 'text-ink-muted'}`}
    >
      · {note}
    </span>
  )
}

/** Left the company on a posted DR: its recipient. */
function issuedDestination(serial: Serial): Lines | null {
  const dr = serial.deliveryReceipt
  if (serial.status !== 'issued' || !dr || !POSTED_DR.includes(dr.status)) return null
  return {
    name: dr.recipient ?? purposeLabel(dr.purpose),
    tag: purposeLabel(dr.purpose),
    reference: dr.drNumber,
    date: dr.date,
  }
}

/** Sold — or a customer's unit handed back on a DR after its sale, in which
 * case the DR is the latest document, not the original sale. */
function soldLines(serial: Serial): Lines | null {
  const sold = soldDestination(serial)
  if (!sold) return null
  const dr = serial.deliveryReceipt
  const drAfterSale = dr && POSTED_DR.includes(dr.status) && (!sold.date || dr.date > sold.date)
  if (dr && drAfterSale) {
    return {
      name: dr.recipient ?? sold.name,
      tag: purposeLabel(dr.purpose),
      reference: dr.drNumber,
      date: dr.date,
    }
  }
  return { name: sold.name, reference: sold.ref, date: sold.date }
}

/** Reserved: what for. */
function heldDestination(serial: Serial): Lines | null {
  const hold = serial.heldBy
  if (serial.status !== 'held' || !hold) return null
  return {
    name: hold.name ?? HOLD_LABELS[hold.kind],
    tag: `Reserved · ${HOLD_LABELS[hold.kind]}`,
    reference: hold.reference,
    date: serial.deliveryReceipt?.date ?? null,
  }
}

/** On its way to another branch. */
function transferDestination(serial: Serial, here: string): Lines | null {
  const transfer = serial.openTransfer
  if (!transfer) return null
  return {
    name: transfer.toWarehouseName ?? here,
    tag: serial.status === 'in_transit' ? 'In transit' : undefined,
    reference: transfer.transferNumber,
    date: transfer.date ?? serial.locationSince,
  }
}

/** On an open ticket (at a service center, or out on a pull-out / loan):
 * it comes back to its branch. */
function ticketDestination(serial: Serial, here: string): Lines | null {
  const ticket = serial.repairTicket
  if (!ticket) return null
  const away =
    !!serial.consignedToSupplier || ticket.reason === 'pull_out' || ticket.reason === 'loan'
  if (!away) return null
  return {
    name: here,
    tag: `Back from ${reasonLabel(ticket.reason).toLowerCase()}`,
    reference: ticket.code,
    date: ticket.expectedReturnDate,
  }
}

/** Where the unit is going, first match wins (NIG #10). */
export function DestinationCell({ serial }: { serial: Serial }): React.JSX.Element {
  const here = locationLabel(serial.currentWarehouse ?? serial.warehouse)
  const lines = issuedDestination(serial) ??
    soldLines(serial) ??
    heldDestination(serial) ??
    transferDestination(serial, here) ??
    ticketDestination(serial, here) ?? { name: here, date: serial.locationSince }
  return <CellLines {...lines} />
}
