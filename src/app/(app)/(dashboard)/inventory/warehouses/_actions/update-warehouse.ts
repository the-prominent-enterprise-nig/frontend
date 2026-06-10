'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'
import { UpdateWarehouseFormSchema } from '@/src/schema/inventory/warehouses'

export async function updateWarehouse(id: string, input: unknown): Promise<ApiResponse<void>> {
  if (!id) {
    return { success: false, error: 'Invalid warehouse ID', message: 'Warehouse ID is required' }
  }

  const parsed = UpdateWarehouseFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      message: parsed.error.issues.map((i) => i.message).join(', '),
    }
  }

  const result = await api.patch(`/inventory/warehouses/${id}`, parsed.data)

  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    return {
      success: false,
      error: errStr || 'Failed to update warehouse',
      message: msg || errStr || 'Failed to update warehouse',
    }
  }

  revalidatePath('/inventory/warehouses')

  return { success: true, message: 'Warehouse updated successfully' }
}
