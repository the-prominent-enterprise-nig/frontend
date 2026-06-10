'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'
import { CreateTransferFormSchema } from '@/src/schema/inventory/transfers'

export async function createTransfer(input: unknown): Promise<ApiResponse<{ id: string }>> {
  const parsed = CreateTransferFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      message: parsed.error.issues.map((i) => i.message).join(', '),
    }
  }

  const result = await api.post<{ id: string }>('/inventory/transfers', {
    ...parsed.data,
  })

  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    return {
      success: false,
      error: errStr || 'Failed to create transfer',
      message: msg || errStr || 'Failed to create transfer',
    }
  }

  revalidatePath('/inventory/transfers')

  return {
    success: true,
    data: result.data,
    message: 'Transfer saved as draft',
  }
}
