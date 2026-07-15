'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'
import { CreateBsrFormSchema } from '@/src/schema/inventory/stock-requisitions'

export async function createBsr(input: unknown): Promise<ApiResponse<{ id: string }>> {
  const parsed = CreateBsrFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      message: parsed.error.issues.map((i) => i.message).join(', '),
    }
  }

  const result = await api.post<{ id: string }>('/inventory/stock-requisitions', parsed.data)

  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    return {
      success: false,
      error: errStr || 'Failed to create requisition',
      message: msg || errStr || 'Failed to create requisition',
    }
  }

  revalidatePath('/inventory/stock-requisitions')

  return {
    success: true,
    data: result.data,
    message: 'Stock requisition created as draft',
  }
}
