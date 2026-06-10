'use server'

import { revalidatePath } from 'next/cache'
import { api } from '@/src/libs/api/client'
import type { ApiResponse } from '@/src/libs/api/client'

export async function getSubstitutes(itemId: string) {
  return api.get(`/inventory/items/${itemId}/substitutes`)
}

export async function addSubstitute(
  itemId: string,
  substituteItemId: string,
  note?: string
): Promise<ApiResponse<void>> {
  const result = await api.post(`/inventory/items/${itemId}/substitutes`, {
    substituteItemId,
    ...(note ? { note } : {}),
  })
  if (!result.success) {
    return { success: false, error: result.error ?? 'Failed', message: result.message }
  }
  revalidatePath('/inventory/items')
  return { success: true, message: 'Substitute added' }
}

export async function removeSubstitute(
  itemId: string,
  substituteItemId: string
): Promise<ApiResponse<void>> {
  const result = await api.delete(`/inventory/items/${itemId}/substitutes/${substituteItemId}`)
  if (!result.success) {
    return { success: false, error: result.error ?? 'Failed', message: result.message }
  }
  revalidatePath('/inventory/items')
  return { success: true, message: 'Substitute removed' }
}
