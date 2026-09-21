'use server'

import { revalidatePath } from 'next/cache'
import { api, type ApiResponse } from '@/src/libs/api/client'
import { ReceiveStockFormSchema } from '@/src/schema/inventory/goods-receiving'
import { getSessionOrNull } from '@/src/libs/auth/actions'
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
  const session = await getSessionOrNull()
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
    // carried through form state; perLineTax switches receiveStock() onto
    // the per-line taxCode/withholdingClass model Manual RR uses instead of
    // the header-driven one every other caller still gets.
    applicationType: 'new_stock' as const,
    perLineTax: true,
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
    return {
      success: false,
      error: errStr || 'Failed to receive stock',
      message: msg || errStr || 'Failed to receive stock',
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
