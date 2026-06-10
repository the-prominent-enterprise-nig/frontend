'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'
import { CreateWarehouseFormSchema } from '@/src/schema/inventory/warehouses'

export async function createWarehouse(input: unknown): Promise<ApiResponse<{ id: string }>> {
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
