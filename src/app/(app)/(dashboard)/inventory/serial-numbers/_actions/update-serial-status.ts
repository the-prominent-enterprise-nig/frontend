'use server'

import { revalidatePath } from 'next/cache'
import { api, type ApiResponse } from '@/src/libs/api/client'
import { UpdateSerialStatusFormSchema } from '@/src/schema/inventory/serial-numbers'

export async function updateSerialStatus(
  id: string,
  input: unknown
): Promise<ApiResponse<unknown>> {
  const parsed = UpdateSerialStatusFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      message: parsed.error.issues.map((i) => i.message).join(', '),
    }
  }

  const result = await api.patch(`/inventory/serial-numbers/${id}/status`, parsed.data)

  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    return {
      success: false,
      error: errStr || 'Failed to update serial status',
      message: msg || errStr || 'Failed to update serial status',
    }
  }

  revalidatePath('/inventory/serial-numbers')

  return { success: true, data: result.data, message: 'Serial number status updated' }
}
