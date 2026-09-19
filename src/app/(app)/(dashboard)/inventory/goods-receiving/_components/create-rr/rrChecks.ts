import {
  isDuplicateSerial,
  norm,
  pendingSerialCount,
  type Blocker,
  type IssueLine,
  type LineIssue,
} from '../../../purchase-orders/_components/receive-po/receiveIssues'
import type { RrLine } from './rrTotals'

/** What a line needs from outside itself to be judged: whether its item is
 * serial-tracked (the form payload has no room for it) and, when the receipt
 * is linked to a purchase order, how many units that PO still expects. */
export type LineContext = {
  isSerialTracked: boolean
  /** Units still outstanding on the linked PO line, or null when this line is
   * not linked to one. */
  outstanding: number | null
  poCode?: string
}

/** The form's lines in the shape the shared serial rules read. `selected` is
 * always "has a quantity" here: unlike the PO screen, a line only exists on
 * this receipt because someone added it. */
export function toIssueLines(
  lines: RrLine[],
  context: (index: number) => LineContext
): IssueLine[] {
  return lines.map((line, index) => ({
    selected: (line.quantityReceived || 0) > 0,
    quantityReceived: line.quantityReceived || 0,
    isSerialTracked: context(index).isSerialTracked,
    serialNumbers: line.serialNumbers,
    qualityHold: line.qualityHold ?? false,
    notes: line.notes,
  }))
}

/** Everything wrong or noteworthy about one line, in the order a receiver
 * would care about it. */
export function rrLineIssues(
  lines: IssueLine[],
  index: number,
  context: LineContext,
  formLine: RrLine
): LineIssue[] {
  const line = lines[index]
  const out: LineIssue[] = []
  if (!line) return out

  if (line.quantityReceived <= 0) {
    out.push({
      kind: 'error',
      fix: 'qty',
      text: 'Enter how many units arrived, or remove the line.',
    })
    return out
  }

  if (line.isSerialTracked) {
    const slots = (line.serialNumbers ?? []).slice(0, line.quantityReceived)
    const filled = slots.filter((serial) => norm(serial ?? '')).length
    if (filled < line.quantityReceived) {
      out.push({
        kind: 'error',
        fix: 'serials',
        code: 'serials-missing',
        text: `${line.quantityReceived - filled} of ${line.quantityReceived} serial numbers still missing.`,
      })
    }
    // Named rather than counted: the receiver has to find the box holding the
    // repeat, and the number points straight at it.
    const duplicates = Array.from(
      new Set(
        slots
          .map((_, unit) => (isDuplicateSerial(lines, index, unit) ? norm(slots[unit] ?? '') : ''))
          .filter(Boolean)
      )
    )
    if (duplicates.length > 0) {
      out.push({
        kind: 'error',
        fix: 'serials',
        text: `Duplicate serial ${duplicates.join(', ')}. Each unit needs a unique number.`,
      })
    }
  }

  // Over-delivery is a warning, not a blocker: the goods are physically here,
  // and the receipt records what arrived. The server files the difference as a
  // discrepancy rather than refusing it.
  if (context.outstanding != null && line.quantityReceived > context.outstanding) {
    const over = line.quantityReceived - context.outstanding
    out.push({
      kind: 'warn',
      text: `${over} more than ${context.poCode ?? 'the PO'} still expects. Recorded as an over-delivery.`,
    })
  }

  if (line.qualityHold) {
    const reason = (line.notes ?? '').trim()
    out.push({
      kind: 'warn',
      text: reason
        ? `QC hold: ${reason}`
        : 'Held for QC. These units land on hold, not as sellable stock. Add a reason so the inspector knows what to check.',
    })
  }

  if (formLine.isFreebie) {
    out.push({ kind: 'warn', text: 'Freebie, received into stock at zero cost.' })
  }

  return out
}

export type HeaderState = {
  supplierId?: string
  warehouseId?: string
  deliveryReceiptNumber?: string
  applicationType: 'new_stock' | 'revert'
  /** True when at least one line is linked to a purchase order line, which is
   * the other way the server can resolve a supplier. */
  hasPoLink: boolean
}

/** Everything standing between the receiver and a posted receipt. */
export function collectRrBlockers(
  header: HeaderState,
  lines: IssueLine[],
  itemLabel: (index: number) => string
): Blocker[] {
  const out: Blocker[] = []

  if (!header.supplierId && !header.hasPoLink) {
    out.push({
      key: 'supplier',
      kind: 'error',
      text: 'Supplier is required, or link this receipt to a purchase order.',
    })
  }

  if (!header.warehouseId) {
    out.push({
      key: 'destination',
      kind: 'error',
      text: 'Pick the location the stock landed in.',
    })
  }

  // Only new stock needs the supplier's delivery receipt: a revert is our own
  // paperwork coming back, and there is no driver handing anything over.
  if (header.applicationType === 'new_stock' && !(header.deliveryReceiptNumber ?? '').trim()) {
    out.push({
      key: 'dr',
      kind: 'error',
      fix: 'dr',
      text: "Delivery receipt number is required. It's on the paper that came with the goods.",
    })
  }

  if (lines.length === 0) {
    out.push({ key: 'lines', kind: 'error', text: 'Add at least one item that arrived.' })
  }

  lines.forEach((line, index) => {
    if (line.quantityReceived > 0) return
    out.push({
      key: `qty-${index}`,
      kind: 'error',
      fix: 'qty',
      lineIndex: index,
      text: `${itemLabel(index)}: enter how many units arrived, or remove the line.`,
    })
  })

  // Duplicates are named per line; the missing-serial rows are rolled up into
  // the single count below instead. On a delivery of six tracked lines the
  // per-line version filled the card with the same sentence six times, when
  // what the receiver needs is one line saying how many units are left.
  lines.forEach((line, index) => {
    if (!line.isSerialTracked || line.quantityReceived <= 0) return
    const slots = (line.serialNumbers ?? []).slice(0, line.quantityReceived)
    const duplicates = Array.from(
      new Set(
        slots
          .map((_, unit) => (isDuplicateSerial(lines, index, unit) ? norm(slots[unit] ?? '') : ''))
          .filter(Boolean)
      )
    )
    if (duplicates.length === 0) return
    out.push({
      key: `dupe-${index}`,
      kind: 'error',
      fix: 'serials',
      lineIndex: index,
      text: `${itemLabel(index)}: duplicate serial ${duplicates.join(', ')}.`,
    })
  })

  const pending = pendingSerialCount(lines)
  if (pending > 0) {
    const first = lines.findIndex((line) => {
      if (!line.isSerialTracked || line.quantityReceived <= 0) return false
      const slots = (line.serialNumbers ?? []).slice(0, line.quantityReceived)
      return slots.filter((serial) => norm(serial ?? '')).length < line.quantityReceived
    })
    out.push({
      key: 'serials',
      kind: 'error',
      fix: 'serials',
      lineIndex: first === -1 ? undefined : first,
      text: `${pending} ${pending === 1 ? 'unit still needs a serial number' : 'units still need serial numbers'}.`,
    })
  }

  return out
}
