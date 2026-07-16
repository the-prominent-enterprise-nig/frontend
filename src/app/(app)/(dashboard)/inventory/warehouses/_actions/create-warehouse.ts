'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'
import { CreateWarehouseFormSchema } from '@/src/schema/inventory/warehouses'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'

export async function createWarehouse(input: unknown): Promise<ApiResponse<{ id: string }>> {
  const session = await getSessionOrNull()
  if (!session) return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  if (!can(session, INVENTORY_PERMISSIONS.WAREHOUSES_CREATE)) {
    return {
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to create warehouses',
    }
  }

  const parsed = CreateWarehouseFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      message: parsed.error.issues.map((i) => i.message).join(', '),
    }
  }

  const result = await api.post<{ id: string }>('/inventory/warehouses', {
    ...parsed.data,
  })

  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    const isDuplicateCode =
      errStr.includes('409') ||
      msg.toLowerCase().includes('code') ||
      msg.toLowerCase().includes('already exists')

    if (isDuplicateCode) {
      return {
        success: false,
        error: 'duplicate_code',
        message: `Warehouse code "${parsed.data.code}" already exists. Please use a unique code.`,
      }
    }

    return {
      success: false,
      error: errStr || 'Failed to create warehouse',
      message: msg || errStr || 'Failed to create warehouse',
    }
  }

  revalidatePath('/inventory/warehouses')

  return {
    success: true,
    data: result.data,
    message: 'Warehouse created successfully',
  }
}
