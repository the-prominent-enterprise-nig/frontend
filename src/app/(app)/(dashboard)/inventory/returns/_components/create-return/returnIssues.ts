import { DISPOSITION_META, type CustomerReturnFormValues } from '@/src/schema/inventory/returns'

/**
 * Everything standing between this return and the Post button.
 *
 * There is no longer a warnings tier. The old screen split these into blocking
 * errors and acknowledgeable warnings and listed both in a panel above the
 * bar; in practice every warning was also a thing the server refused, so the
 * distinction only taught people that the panel could be ignored. Now the bar
 * names the first gap and the field wearing it turns red — one place to look,
 * and it is next to the button that is refusing to work.
 */
export type ReturnGap = {
  /** The short phrase the sticky bar prints after "Needs". */
  need: string
  /** The full sentence, for the toast on a keyboard submit. */
  message: string
  /** Which picked line it belongs to, so the screen can scroll to it. */
  lineIndex?: number
}

export function collectGaps(values: CustomerReturnFormValues): ReturnGap[] {
  const gaps: ReturnGap[] = []

  if (!values.warehouseId) {
    gaps.push({
      need: 'the branch taking the goods back',
      message: 'Choose which branch is taking the goods back.',
    })
  }

  if (!values.lines.length) {
    gaps.push({
      need: 'something ticked',
      message: 'Nothing has been ticked yet — pick what is coming back.',
    })
  }

  // One document credits one invoice, so two receipts cannot ride on one
  // return: the second invoice's lines would be credited against the first.
  // Splitting them is the clerk's call, not something to guess at silently.
  const receipts = Array.from(
    new Set(values.lines.map((l) => l.sourceReceiptNumber).filter(Boolean))
  )
  if (receipts.length > 1) {
    gaps.push({
      need: 'one receipt at a time',
      message: `These come off ${receipts.length} different receipts. One return credits one invoice, so post them separately — untick the ones from ${receipts[1]}.`,
    })
  }

  values.lines.forEach((line, index) => {
    const at = line.itemSku ?? line.itemName ?? `line ${index + 1}`
    const named = line.itemName ?? at

    if (!(line.quantity > 0)) {
      gaps.push({
        need: `a quantity on ${at}`,
        message: `${named}: how many came back?`,
        lineIndex: index,
      })
    } else if (line.soldQuantity != null && line.quantity > line.soldQuantity) {
      gaps.push({
        need: `a quantity within what was sold on ${at}`,
        message: `${named}: only ${line.soldQuantity} were sold on that line.`,
        lineIndex: index,
      })
    }

    if (!line.reasonCode) {
      gaps.push({
        need: `a reason on ${at}`,
        message: `${named}: pick why it came back.`,
        lineIndex: index,
      })
    }

    if (!line.disposition) {
      gaps.push({
        need: `a decision on ${at}`,
        message: `${named}: say what happens to the unit.`,
        lineIndex: index,
      })
      return
    }

    if (DISPOSITION_META[line.disposition].needs === 'text' && !line.faultNote?.trim()) {
      gaps.push({
        need: `a fault note on ${at}`,
        message: `${named}: say what is wrong with it before it is ${
          line.disposition === 'scrap' ? 'written off' : 'held back'
        }.`,
        lineIndex: index,
      })
    }

    if (line.disposition === 'repair') {
      if (!line.serialNumberId) {
        gaps.push({
          need: `the specific unit on ${at}`,
          message: `${named}: a repair needs the specific unit — a custody sheet records one named serial.`,
          lineIndex: index,
        })
      }
      if (line.quantity > 1) {
        gaps.push({
          need: `one unit per repair on ${at}`,
          message: `${named}: a repair covers exactly one unit. Tick it again as its own line.`,
          lineIndex: index,
        })
      }
    }

    // Only a serial-tracked unit needs a named replacement, and the only
    // thing the form knows about that is whether the unit coming back had a
    // serial of its own. Saying "a serial-tracked swap needs one" on a line
    // that is not serial-tracked sent people looking for a picker that had
    // nothing to offer them.
    if (line.disposition === 'exchange' && line.serialNumberId && !line.replacementSerialNumberId) {
      gaps.push({
        need: `a replacement unit on ${at}`,
        message: `${named}: choose the replacement unit going out.`,
        lineIndex: index,
      })
    }

    // The server refuses this outright, because one fractional line would
    // take the whole document's credit memo down with it.
    if (values.arInvoiceId && line.disposition !== 'repair' && !Number.isInteger(line.quantity)) {
      gaps.push({
        need: `a whole number on ${at}`,
        message: `${named}: a part-unit cannot be credited, and one such line blocks the credit for every other line here.`,
        lineIndex: index,
      })
    }
  })

  // A custody record with no name records custody for no one.
  if (!values.customerId && values.lines.some((l) => l.disposition === 'repair')) {
    gaps.push({
      need: 'a customer on the repair',
      message: 'A repair intake needs a customer — the unit stays their property.',
    })
  }

  return gaps
}
