'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'

export async function setUserStatus(userId: string, isActive: boolean): Promise<ApiResponse> {
  try {
    const response = await api.patch(`/users/${userId}/status`, { isActive })

    if (!response.success) {
      return {
        success: false,
        error: response.error || 'Failed to update user status',
        message: response.message,
      }
    }

    revalidatePath('/settings/users')
    return { success: true }
  } catch (error) {
    console.error('Error updating user status:', error)
    return {
      success: false,
      error: 'Failed to update user status',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
