'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'
import { CreateWarehouseRequestFormSchema } from '@/src/schema/inventory/warehouse-requests'

export async function createWarehouseRequest(input: unknown): Promise<ApiResponse<{ id: string }>> {
  const parsed = CreateWarehouseRequestFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      message: parsed.error.issues.map((i) => i.message).join(', '),
    }
  }

  const result = await api.post<{ id: string }>('/inventory/warehouse-requests', {
    ...parsed.data,
  })

  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    return {
      success: false,
      error: errStr || 'Failed to create warehouse request',
      message: msg || errStr || 'Failed to create warehouse request',
    }
  }

  revalidatePath('/inventory/warehouse-requests')

  return {
    success: true,
    data: result.data,
    message: 'Warehouse request submitted',
  }
}
