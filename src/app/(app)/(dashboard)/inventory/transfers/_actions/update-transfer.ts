'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'
import { CreateTransferFormSchema } from '@/src/schema/inventory/transfers'

/**
 * Correcting an undispatched request. Validated against the *create* schema
 * on purpose: an edit replaces the request wholesale rather than patching
 * fields, so what goes over the wire has to be a complete, valid request —
 * the same one the user would have typed if they had got it right the first
 * time. The backend's UpdateTransferDto extends CreateTransferDto for the
 * same reason.
 *
 * The response's status is worth surfacing to the caller: editing re-runs
 * approval routing from the start, so a request that was sitting at
 * 'requested' can come back as 'pending_manager_approval'. The toast reads
 * that field rather than assuming the status is unchanged.
 */
export async function updateTransfer(
  id: string,
  input: unknown
): Promise<ApiResponse<{ id: string; status: string }>> {
  if (!id) {
    return { success: false, error: 'Invalid transfer ID', message: 'Transfer ID is required' }
  }

  const parsed = CreateTransferFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      message: parsed.error.issues.map((i) => i.message).join(', '),
    }
  }

  // Same '' -> undefined normalization createTransfer does, and for the same
  // reason: the backend's @IsOptional() excuses undefined, not an empty
  // string, so a blank Expected Arrival would fail @IsDateString().
  const result = await api.patch<{ id: string; status: string }>(`/inventory/transfers/${id}`, {
    ...parsed.data,
    expectedArrival: parsed.data.expectedArrival || undefined,
  })

  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    return {
      success: false,
      error: errStr || 'Failed to update transfer',
      message: msg || errStr || 'Failed to update transfer',
    }
  }

  revalidatePath('/inventory/transfers')

  return {
    success: true,
    data: result.data,
    message: 'Transfer request updated and resubmitted for approval',
  }
}
