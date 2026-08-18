'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'

export async function resendInvite(userId: string): Promise<ApiResponse> {
  try {
    const response = await api.post(`/users/${userId}/resend-invite`, {})

    if (!response.success) {
      return {
        success: false,
        error: response.error || 'Failed to resend invite',
        message: response.message,
      }
    }

    revalidatePath('/settings/users')
    return { success: true }
  } catch (error) {
    console.error('Error resending invite:', error)
    return {
      success: false,
      error: 'Failed to resend invite',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
