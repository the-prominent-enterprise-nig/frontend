import type { PurchaseOrderSummary } from '@/src/schema/inventory/purchase-orders'

/** An error blocks posting; a warning is something the receiver must look at
 * and consciously accept at the Review step. The distinction is the whole
 * point of the checks card — a short delivery and a missing serial both used
 * to read as "the form is wrong", when only one of them is. */
export type IssueKind = 'error' | 'warn'

/** Which control the "Fix" affordance should take the receiver to. */
export type IssueFix = 'qty' | 'serials' | 'dr'

export type LineIssue = {
  kind: IssueKind
  text: string
  fix?: IssueFix
  /** Tags the issues the checks card deliberately leaves out — see
   * `collectBlockers`. */
  code?: 'serials-missing'
}

/** A blocker carries the line it belongs to so the checks card can jump
 * straight to the offending control rather than just naming it. */
export type Blocker = LineIssue & {
  key: string
  kind: 'error'
  lineIndex?: number
}

/** The slice of a form line these rules actually read. Deliberately not the
 * full form type: these are pure functions used by both the live checks card
 * and the submit guard, and neither should be able to reach past this. */
export type IssueLine = {
  selected: boolean
  quantityReceived: number
  isSerialTracked?: boolean
  serialNumbers?: string[]
  qualityHold: boolean
  notes?: string
}

export const norm = (serial: string): string => serial.trim().toUpperCase()

export const remainingOf = (poLine: PurchaseOrderSummary['lines'][number]): number =>
  Math.max(Number(poLine.quantity) - Number(poLine.receivedQuantity ?? 0), 0)

/**
 * Every serial typed anywhere on this receipt except one box, upper-cased for
 * comparison.
 *
 * Scoped to the whole receipt rather than the line, because that is the scope
 * the backend rejects on: `stock.service.ts` throws a 400 for a serial listed
 * more than once *in the request*, not merely more than once on a line. Two
 * units of different items sharing a typo'd serial was a round-trip failure
 * with nothing on screen to explain it.
 */
export function serialsElsewhere(
  lines: IssueLine[],
  exceptLine: number,
  exceptUnit: number
): Set<string> {
  const seen = new Set<string>()
  lines.forEach((line, lineIdx) => {
    if (!line.selected) return
    ;(line.serialNumbers ?? []).forEach((serial, unitIdx) => {
      if (lineIdx === exceptLine && unitIdx === exceptUnit) return
      const value = norm(serial ?? '')
      if (value) seen.add(value)
    })
  })
  return seen
}

/** True when this exact box duplicates a serial typed somewhere else. */
export function isDuplicateSerial(
  lines: IssueLine[],
  lineIndex: number,
  unitIndex: number
): boolean {
  const value = norm(lines[lineIndex]?.serialNumbers?.[unitIndex] ?? '')
  if (!value) return false
  return serialsElsewhere(lines, lineIndex, unitIndex).has(value)
}

function serialIssues(line: IssueLine, lines: IssueLine[], lineIndex: number): LineIssue[] {
  if (!line.isSerialTracked) return []
  const out: LineIssue[] = []
  const slots = (line.serialNumbers ?? []).slice(0, line.quantityReceived)
  const filled = slots.filter((s) => norm(s ?? '')).length

  if (filled < line.quantityReceived) {
    const missing = line.quantityReceived - filled
    out.push({
      kind: 'error',
      fix: 'serials',
      code: 'serials-missing',
      text: `${missing} of ${line.quantityReceived} serial numbers still missing.`,
    })
  }

  // Named rather than counted: the receiver has to find the box holding the
  // repeat, and "duplicate serial BK09-AA-7741" points at it directly.
  const duplicates = slots
    .map((_, unitIdx) => (isDuplicateSerial(lines, lineIndex, unitIdx) ? norm(slots[unitIdx]) : ''))
    .filter(Boolean)
  const unique = Array.from(new Set(duplicates))
  if (unique.length > 0) {
    out.push({
      kind: 'error',
      fix: 'serials',
      text: `Duplicate serial ${unique.join(', ')} — each unit needs a unique number.`,
    })
  }
  return out
}

/**
 * Everything wrong or noteworthy about one line, in the order a receiver
 * would care about it.
 *
 * Over-receipt is absent by design: quantity is capped at the PO remainder as
 * it is typed (see `capQuantity`), so a line can never hold more than remains.
 */
export function lineIssues(
  line: IssueLine,
  poLine: PurchaseOrderSummary['lines'][number],
  lines: IssueLine[],
  lineIndex: number
): LineIssue[] {
  if (!line.selected || line.quantityReceived <= 0) return []

  // A short delivery is not flagged: quantity is capped at the PO remainder as
  // it is typed, the line already shows Ordered / Received to date / Remaining
  // beside the box, and the PO simply stays open for the next receipt. Calling
  // the normal case a warning trained receivers to click past the ones that
  // matter.
  const out: LineIssue[] = [...serialIssues(line, lines, lineIndex)]

  if (line.qualityHold) {
    const reason = (line.notes ?? '').trim()
    out.push({
      kind: 'warn',
      text: reason
        ? `QC hold: ${reason}`
        : 'Held for QC — stock lands on hold, not sellable on hand. Add a reason so the inspector knows what to check.',
    })
  }

  return out
}

/** Quantity clamped to what the PO still owes, rounded to whole units.
 * Returns the clamped value and whether clamping actually bit, so the caller
 * can say so rather than silently rewriting what was typed. */
export function capQuantity(raw: number, remaining: number): { qty: number; capped: boolean } {
  const rounded = Number.isFinite(raw) ? Math.max(0, Math.round(raw)) : 0
  if (rounded > remaining) return { qty: remaining, capped: true }
  return { qty: rounded, capped: false }
}

/** Units on selected serial-tracked lines with no serial typed yet. The checks
 * card uses it to stay honest about readiness without listing a row per line —
 * the lines and the capture drawer already carry the detail. */
export function pendingSerialCount(lines: IssueLine[]): number {
  return lines.reduce((total, line) => {
    if (!line.selected || !line.isSerialTracked || line.quantityReceived <= 0) return total
    const slots = (line.serialNumbers ?? []).slice(0, line.quantityReceived)
    const filled = slots.filter((serial) => norm(serial ?? '')).length
    return total + Math.max(line.quantityReceived - filled, 0)
  }, 0)
}

/** Index of the first selected line still short of serials, for the "Fix"
 * jump on the rolled-up blocker. */
function firstLineMissingSerials(lines: IssueLine[]): number | undefined {
  const index = lines.findIndex((line) => {
    if (!line.selected || !line.isSerialTracked || line.quantityReceived <= 0) return false
    const slots = (line.serialNumbers ?? []).slice(0, line.quantityReceived)
    return slots.filter((serial) => norm(serial ?? '')).length < line.quantityReceived
  })
  return index === -1 ? undefined : index
}

/** Everything standing between the receiver and a posted receipt. */
export function collectBlockers(
  lines: IssueLine[],
  poLines: PurchaseOrderSummary['lines'],
  deliveryReceiptNumber: string,
  itemLabel: (index: number) => string
): Blocker[] {
  const out: Blocker[] = []

  if (!deliveryReceiptNumber.trim()) {
    out.push({ key: 'dr', kind: 'error', fix: 'dr', text: 'Delivery receipt number is required.' })
  }

  const receiving = lines.filter((l) => l.selected && l.quantityReceived > 0).length
  if (receiving === 0) {
    out.push({
      key: 'qty',
      kind: 'error',
      fix: 'qty',
      text: 'Enter a quantity on at least one line.',
    })
  }

  lines.forEach((line, idx) => {
    const poLine = poLines[idx]
    if (!poLine) return
    lineIssues(line, poLine, lines, idx)
      // The per-line "N of M serial numbers still missing" rows are rolled up
      // into the single entry below instead: on a delivery of six tracked
      // lines they filled the card with the same sentence six times, when
      // what the receiver needs is one line saying how many units are left.
      .filter((issue) => issue.kind === 'error' && issue.code !== 'serials-missing')
      .forEach((issue, n) => {
        out.push({
          ...issue,
          kind: 'error',
          key: `${idx}-${n}`,
          lineIndex: idx,
          text: `${itemLabel(idx)} — ${issue.text}`,
        })
      })
  })

  const pending = pendingSerialCount(lines)
  if (pending > 0) {
    out.push({
      key: 'serials',
      kind: 'error',
      fix: 'serials',
      // Fix opens the first line that is short, which is where the receiver
      // has to start anyway.
      lineIndex: firstLineMissingSerials(lines),
      text: `${pending} ${pending === 1 ? 'unit still needs a serial number' : 'units still need serial numbers'}.`,
    })
  }

  return out
}

/** The amber notes that survive to the Review step's acknowledgement. */
export function collectWarnings(
  lines: IssueLine[],
  poLines: PurchaseOrderSummary['lines'],
  itemLabel: (index: number) => string
): { key: string; text: string }[] {
  const out: { key: string; text: string }[] = []
  lines.forEach((line, idx) => {
    const poLine = poLines[idx]
    if (!poLine) return
    lineIssues(line, poLine, lines, idx)
      .filter((issue) => issue.kind === 'warn')
      .forEach((issue, n) => {
        out.push({ key: `${idx}-w${n}`, text: `${itemLabel(idx)} — ${issue.text}` })
      })
  })
  return out
}
