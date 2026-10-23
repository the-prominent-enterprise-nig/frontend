import type { CustomerReturnResult } from '../../_actions/create-customer-return'
import { REASON_LABELS, type CustomerReturnFormValues } from '@/src/schema/inventory/returns'
import { printCustomerCopy } from '../printCustomerCopy'

export type SlipContext = {
  customerName?: string
  branchName?: string
  values: CustomerReturnFormValues
  result: CustomerReturnResult
}

/**
 * The same envelope the document endpoint returns, built from what was just
 * submitted — the fallback for when that call cannot be made.
 *
 * `enterprise: null` is the one real difference, and the shell already
 * renders that block empty rather than breaking. The replacement serial is
 * missing for the same reason: the form holds the id it picked, not the
 * number printed on the unit, and only the server can resolve one to the
 * other.
 */
function localEnvelope({ customerName, branchName, values, result }: SlipContext) {
  return {
    documentType: 'customer_return',
    documentNumber: result.receivingReportNumber,
    generatedAt: new Date().toISOString(),
    enterprise: null,
    document: {
      returnNumber: result.returnNumber,
      salesInvoiceNumber: values.salesInvoiceNumber ?? null,
      creditMemoNumber: result.creditMemoNumber ?? null,
      notes: values.notes ?? null,
      occurredAt: new Date().toISOString(),
      customer: customerName ? { name: customerName } : null,
      warehouse: { branch: branchName ? { name: branchName } : null },
      lines: values.lines.map((line) => ({
        item: { sku: line.itemSku ?? null, name: line.itemName ?? null },
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        disposition: line.disposition || null,
        // Composed the way createCustomerReturn() composes it for the server,
        // so the paper reads the same whichever of the two built it.
        reason:
          [line.reasonCode ? REASON_LABELS[line.reasonCode] : '', line.faultNote?.trim()]
            .filter(Boolean)
            .join(' — ') || null,
        serialNumber: line.serialNumber ?? null,
        replacementSerialNumber: null,
      })),
    },
  }
}

/**
 * The customer's copy, printed straight off the posted dialog.
 *
 * The window, the fetch and the paper are all printCustomerCopy() — the same
 * path the returns list reprints through, so the counter and a reprint hand
 * out the identical document. This adds only the fallback: at the counter the
 * customer is standing there, and a slip that depends on a round trip is a
 * slip that sometimes never prints.
 */
export function printReturnSlip(context: SlipContext): Promise<void> {
  return printCustomerCopy(context.result.id, () => localEnvelope(context))
}
