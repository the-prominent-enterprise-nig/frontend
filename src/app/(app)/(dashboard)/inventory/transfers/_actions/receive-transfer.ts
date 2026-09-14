'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'
import { ReceiveTransferFormSchema } from '@/src/schema/inventory/transfers'

export async function receiveTransfer(
  id: string,
  input: unknown
): Promise<
  ApiResponse<{ status: string; goodsReceiptId: string | null; goodsReceiptCode: string | null }>
> {
  if (!id) {
    return { success: false, error: 'Invalid transfer ID', message: 'Transfer ID is required' }
  }

  const parsed = ReceiveTransferFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      message: parsed.error.issues.map((i) => i.message).join(', '),
    }
  }

  const body = {
    receivedDate: parsed.data.receivedDate,
    notes: parsed.data.notes,
    lines: parsed.data.lines.map((line) => ({
      stockTransferLineId: line.stockTransferLineId,
      quantityReceived: line.quantityReceived,
      correctedSerialNumber: line.correctedSerialNumber || undefined,
      replacementSerialNumberId: line.replacementSerialNumberId || undefined,
      correctionReason: line.correctionReason || undefined,
    })),
    extraLines: parsed.data.extraLines?.map((line) => ({
      itemId: line.itemId,
      quantity: line.quantity,
      notes: line.notes || undefined,
    })),
  }

  const result = await api.patch<{
    status: string
    goodsReceiptId: string | null
    goodsReceiptCode: string | null
  }>(`/inventory/transfers/${id}/receive`, body)

  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    return {
      success: false,
      error: errStr || 'Failed to receive transfer',
      message: msg || errStr || 'Failed to receive transfer',
    }
  }

  revalidatePath('/inventory/transfers')

  const message =
    result.data?.status === 'partially_received'
      ? 'Transfer partially received — discrepancy recorded, stock added only for received quantities'
      : 'Transfer received — stock added to destination branch'

  // Scenario 50 — the RR this call just issued, so the receiver can jump
  // straight to it without a second lookup.
  return {
    success: true,
    data: {
      status: result.data?.status ?? 'received',
      goodsReceiptId: result.data?.goodsReceiptId ?? null,
      goodsReceiptCode: result.data?.goodsReceiptCode ?? null,
    },
    message,
  }
}
