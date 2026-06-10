'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'
import { CreateItemFormSchema, CreateItemFormValues } from '@/src/schema/inventory/items'

export async function createItem(input: unknown): Promise<ApiResponse<{ id: string }>> {
  const parsed = CreateItemFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      message: parsed.error.issues.map((i) => i.message).join(', '),
    }
  }

  const data: CreateItemFormValues = {
    ...parsed.data,
  }

  const result = await api.post<{ id: string }>('/inventory/items', data)

  if (!result.success) {
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    // 409 = duplicate SKU
    const isDuplicateSku =
      errStr.includes('409') ||
      msg.toLowerCase().includes('sku') ||
      msg.toLowerCase().includes('already exists') ||
      msg.toLowerCase().includes('duplicate')

    if (isDuplicateSku) {
      return {
        success: false,
        error: 'duplicate_sku',
        message: `SKU "${parsed.data.sku}" already exists. Please use a unique SKU.`,
      }
    }

    return {
      success: false,
      error: result.error || 'Failed to create item',
      message: result.message,
    }
  }

  revalidatePath('/inventory/items')

  return {
    success: true,
    data: result.data,
    message: 'Item created successfully',
  }
}
