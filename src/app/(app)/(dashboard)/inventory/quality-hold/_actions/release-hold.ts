'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'
import { ReleaseHoldFormSchema } from '@/src/schema/inventory/quality-hold'

export async function releaseHold(batchId: string, input: unknown): Promise<ApiResponse<void>> {
  if (!batchId) return { success: false, error: 'ID required', message: 'Batch ID is required' }

  const parsed = ReleaseHoldFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      message: parsed.error.issues.map((i) => i.message).join(', '),
    }
  }

  const { action, reason, releasedQuantity, destinationWarehouseId, supplierRef } = parsed.data

  const reasonText = supplierRef ? `${reason} | Supplier/PO Ref: ${supplierRef}` : reason

  const payload: Record<string, unknown> = {
    action,
    reason: reasonText,
  }
  if (releasedQuantity !== undefined) payload.releasedQuantity = releasedQuantity
  if (destinationWarehouseId) payload.destinationWarehouseId = destinationWarehouseId

  const result = await api.patch(`/inventory/batches/${batchId}/release`, payload)

  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    return {
      success: false,
      error: errStr || 'Failed to process hold decision',
      message: msg || errStr || 'Failed to process hold decision',
    }
  }

  revalidatePath('/inventory/quality-hold')

  const actionLabel =
    action === 'release'
      ? 'released'
      : action === 'partial_release'
        ? 'partially released'
        : 'rejected (RTV)'
  return {
    success: true,
    message: `Batch ${actionLabel} successfully`,
  }
}
