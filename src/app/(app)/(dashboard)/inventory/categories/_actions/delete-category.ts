'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'

export async function deleteCategory(id: string): Promise<ApiResponse<void>> {
  const result = await api.delete<void>(`/inventory/categories/${id}`)

  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    const hasChildren =
      errStr.includes('409') ||
      msg.toLowerCase().includes('children') ||
      msg.toLowerCase().includes('items')

    if (hasChildren) {
      return {
        success: false,
        error: 'has_dependents',
        message: 'Cannot delete a category that has sub-categories or assigned items.',
      }
    }

    return {
      success: false,
      error: errStr || 'Failed to delete category',
      message: msg || errStr || 'Failed to delete category',
    }
  }

  revalidatePath('/inventory/categories')

  return { success: true, message: 'Category deleted successfully' }
}
