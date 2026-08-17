'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'

export async function editPendingEmail(userId: string, email: string): Promise<ApiResponse> {
  try {
    const response = await api.patch(`/users/${userId}/pending-email`, { email })

    if (!response.success) {
      return {
        success: false,
        error: response.error || 'Failed to update email',
        message: response.message,
      }
    }

    revalidatePath('/settings/users')
    return { success: true }
  } catch (error) {
    console.error('Error updating pending email:', error)
    return {
      success: false,
      error: 'Failed to update email',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
