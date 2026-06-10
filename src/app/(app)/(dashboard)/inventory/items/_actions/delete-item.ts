'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'

export async function deleteItem(id: string): Promise<ApiResponse<void>> {
  if (!id) {
    return { success: false, error: 'Invalid item ID', message: 'Item ID is required' }
  }

  const result = await api.delete(`/inventory/items/${id}`)

  if (!result.success) {
    const hasStock =
      result.error?.includes('409') ||
      result.message?.toLowerCase().includes('stock') ||
      result.message?.toLowerCase().includes('on hand')

    if (hasStock) {
      return {
        success: false,
        error: 'has_stock',
        message: 'Cannot delete an item that has stock on hand. Archive it instead.',
      }
    }

    return {
      success: false,
      error: result.error || 'Failed to delete item',
      message: result.message,
    }
  }

  revalidatePath('/inventory/items')

  return { success: true, message: 'Item deleted successfully' }
}
