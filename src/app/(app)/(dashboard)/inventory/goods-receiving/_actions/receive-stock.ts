'use server'

import { revalidatePath } from 'next/cache'
import { api, type ApiResponse } from '@/src/libs/api/client'
import { ReceiveStockFormSchema } from '@/src/schema/inventory/goods-receiving'
import { getSessionIfAvailable } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'

/** What the caller gets back from a successful post.
 *
 * The backend returns the whole GoodsReceipt (header columns, `lines[]` with
 * their `discrepancy` block, `journalEntryId`, and the auto-generated
 * `RR-YYYYMMDD-NNNN` code). This used to be typed as `{ id }` alone, which
 * threw `code` away — so a screen that had just posted a receipt could only
 * say "done", never name the document it created. Narrow rather than exact:
 * only the fields a caller reads are promised, and the rest ride along. */
export type ReceivedStockResult = {
  id: string
  /** The receiving report number, e.g. `RR-20260910-0007`. */
  code?: string | null
}

export async function receiveStock(input: unknown): Promise<ApiResponse<ReceivedStockResult>> {
  const session = await getSessionIfAvailable()
  if (!session) {
    return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  }
  if (!can(session, INVENTORY_PERMISSIONS.RECEIVE_CREATE)) {
    return {
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to receive stock',
    }
  }

  const parsed = ReceiveStockFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      message: parsed.error.issues.map((i) => i.message).join(', '),
    }
  }

  const { purchaseOrderNumber, receivedAt, modeOfTransfer, lines, ...rest } = parsed.data

  const backendPayload = {
    ...rest,
    // Scenario 55 (Stock-side Manual RR parity) — this screen no longer
    // collects Application Type or a header VAT/withholding treatment at
    // all (see ReceiveStockFormSchema's own comment). applicationType is
    // still required by the DTO, so it's sent as a fixed value rather than
    // carried through form state. perLineTax (sent only by the Create RR
    // screen) is passed through in `rest`; a caller that omits it, like
    // Receive Against PO, keeps the supplier-driven VAT/withholding model.
    applicationType: 'new_stock' as const,
    ...(receivedAt && receivedAt.trim() ? { receivedAt: receivedAt.trim() } : {}),
    ...(modeOfTransfer && modeOfTransfer.trim() ? { modeOfTransfer: modeOfTransfer.trim() } : {}),
    ...(purchaseOrderNumber && purchaseOrderNumber.trim()
      ? { purchaseOrderNumber: purchaseOrderNumber.trim() }
      : {}),
    lines: lines.map(({ itemId, batchNumber, serialNumbers, ...lineRest }) => ({
      ...lineRest,
      itemId,
      ...(batchNumber ? { batchNumber } : {}),
      ...(serialNumbers && serialNumbers.length > 0 ? { serialNumbers } : {}),
    })),
  }

  const result = await api.post<ReceivedStockResult>('/inventory/stock/receive', backendPayload)

  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    const readable = repairReturnMessage(msg || errStr)
    return {
      success: false,
      error: errStr || 'Failed to receive stock',
      message: readable ?? (msg || errStr || 'Failed to receive stock'),
    }
  }

  revalidatePath('/inventory/goods-receiving')
  revalidatePath('/inventory/stock')
  revalidatePath('/inventory/purchase-orders')

  return {
    success: true,
    data: result.data,
    message: 'Stock received and inventory updated successfully',
  }
}

/** Scenario 73 — the Repair/Return refusals come back as codes carrying the
 * serial (and service center) they are about; said in words here. */
const REPAIR_RETURN_MESSAGES: Record<string, (serial: string, center: string) => string> = {
  unit_is_at_service_center_receive_it_from_service_center: (sn, sc) =>
    `${sn} is out at ${sc || 'a service center'} — receive it with Origin "From Service Center".`,
  unit_is_at_another_service_center: (sn, sc) =>
    `${sn} is out at ${sc || 'another service center'}, not this one.`,
  unit_already_back_from_repair: (sn) => `${sn} is already back from repair.`,
  unit_has_no_open_repair_ticket: (sn) =>
    `${sn} is our own stock with no repair ticket — it cannot come back from a service center.`,
  unit_not_on_a_ticket_in_your_branch: (sn) => `${sn} is not on a repair ticket in your branch.`,
  ticket_units_must_come_back_together: (code) =>
    `Every unit on ${code} has to come back on the same receipt.`,
}

function repairReturnMessage(raw: string): string | undefined {
  const match = Object.keys(REPAIR_RETURN_MESSAGES).find((code) => raw.includes(`${code}:`))
  if (!match) return undefined
  const [serial = '', center = ''] = raw
    .slice(raw.indexOf(`${match}:`) + match.length + 1)
    .split(':')
  return REPAIR_RETURN_MESSAGES[match](serial.trim(), center.replace(/["\]}]+$/, '').trim())
}
