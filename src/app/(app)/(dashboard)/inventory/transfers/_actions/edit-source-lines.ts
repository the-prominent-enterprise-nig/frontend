'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { api, ApiResponse } from '@/src/libs/api/client'

const EditSourceLinesSchema = z.object({
  lines: z
    .array(
      z.object({
        itemId: z.string().min(1, 'Item is required'),
        quantity: z.number().positive('Quantity must be greater than 0'),
      })
    )
    .min(1, 'At least one item line is required'),
})

/**
 * The source custodian edits an incoming request's lines before accepting
 * it. Only the lines go over the wire — the route, dates and reason stay the
 * requester's — and the request stays Requested with its approvals.
 */
export async function editSourceLines(id: string, input: unknown): Promise<ApiResponse<void>> {
  if (!id) {
    return { success: false, error: 'Invalid transfer ID', message: 'Transfer ID is required' }
  }
  const parsed = EditSourceLinesSchema.safeParse(input)
  if (!parsed.success) {
    const message = parsed.error.issues.map((i) => i.message).join(', ')
    return { success: false, error: 'Validation failed', message }
  }

  const result = await api.patch(`/inventory/transfers/${id}/source-lines`, parsed.data)
  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    const fallback = 'Failed to update the request'
    return { success: false, error: errStr || fallback, message: msg || errStr || fallback }
  }

  revalidatePath('/inventory/transfers')
  return { success: true, message: 'Request updated — you can accept it now' }
}
