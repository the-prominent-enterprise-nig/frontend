'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'

export async function removeBranch(userId: string, branchId: string): Promise<ApiResponse> {
  try {
    const response = await api.delete(`/users/${userId}/branches/${branchId}`)

    if (!response.success) {
      return {
        success: false,
        error: response.error || 'Failed to remove branch',
        message: response.message,
      }
    }

    revalidatePath('/settings')
    revalidatePath('/settings/users')
    return { success: true }
  } catch (error) {
    console.error('Error removing branch:', error)
    return {
      success: false,
      error: 'Failed to remove branch',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
