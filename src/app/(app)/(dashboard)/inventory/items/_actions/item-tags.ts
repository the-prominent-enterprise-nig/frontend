'use server'

import { revalidatePath } from 'next/cache'
import { api } from '@/src/libs/api/client'
import type { ApiResponse } from '@/src/libs/api/client'

export async function getItemTags(itemId: string) {
  return api.get(`/inventory/items/${itemId}/tags`)
}

export async function addItemTag(itemId: string, tag: string): Promise<ApiResponse<void>> {
  const result = await api.post(`/inventory/items/${itemId}/tags`, { tag })
  if (!result.success) {
    return { success: false, error: result.error ?? 'Failed', message: result.message }
  }
  revalidatePath('/inventory/items')
  return { success: true, message: 'Tag added' }
}

export async function removeItemTag(itemId: string, tag: string): Promise<ApiResponse<void>> {
  const result = await api.delete(`/inventory/items/${itemId}/tags/${tag}`)
  if (!result.success) {
    return { success: false, error: result.error ?? 'Failed', message: result.message }
  }
  revalidatePath('/inventory/items')
  return { success: true, message: 'Tag removed' }
}
