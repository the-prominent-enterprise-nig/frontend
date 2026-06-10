'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'
import { PlaceOnHoldFormSchema } from '@/src/schema/inventory/quality-hold'

export async function placeOnHold(input: unknown): Promise<ApiResponse<{ id: string }>> {
  const parsed = PlaceOnHoldFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      message: parsed.error.issues.map((i) => i.message).join(', '),
    }
  }

  const { itemId, reason, receivedViaGrId, manufactureDate, expiryDate, batchNumber } = parsed.data

  const payload = {
    itemId,
    batchNumber,
    status: 'quarantine' as const,
    receivedViaGrId: receivedViaGrId || undefined,
    manufactureDate: manufactureDate || undefined,
    expiryDate: expiryDate || undefined,
    notes: reason,
  }

  const result = await api.post<{ id: string }>('/inventory/batches', payload)

  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    return {
      success: false,
      error: errStr || 'Failed to place stock on hold',
      message: msg || errStr || 'Failed to place stock on hold',
    }
  }

  revalidatePath('/inventory/quality-hold')

  return {
    success: true,
    data: result.data,
    message: 'Stock placed on quality hold — not available for sale or transfer',
  }
}
