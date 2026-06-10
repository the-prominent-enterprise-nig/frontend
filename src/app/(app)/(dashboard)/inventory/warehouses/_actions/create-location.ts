'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'
import { CreateLocationFormSchema } from '@/src/schema/inventory/warehouses'

export async function createLocation(
  warehouseId: string,
  input: unknown
): Promise<ApiResponse<{ id: string }>> {
  if (!warehouseId) {
    return { success: false, error: 'Invalid warehouse ID', message: 'Warehouse ID is required' }
  }

  const parsed = CreateLocationFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      message: parsed.error.issues.map((i) => i.message).join(', '),
    }
  }

  const result = await api.post<{ id: string }>(`/inventory/warehouses/${warehouseId}/locations`, {
    ...parsed.data,
    warehouseId,
  })

  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    return {
      success: false,
      error: errStr || 'Failed to create location',
      message: msg || errStr || 'Failed to create location',
    }
  }

  revalidatePath('/inventory/warehouses')

  return {
    success: true,
    data: result.data,
    message: 'Sub-location added successfully',
  }
}
