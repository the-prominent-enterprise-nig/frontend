'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'

export async function revokeInvite(userId: string): Promise<ApiResponse> {
  try {
    const response = await api.post(`/users/${userId}/revoke-invite`, {})

    if (!response.success) {
      return {
        success: false,
        error: response.error || 'Failed to revoke invite',
        message: response.message,
      }
    }

    revalidatePath('/settings/users')
    return { success: true }
  } catch (error) {
    console.error('Error revoking invite:', error)
    return {
      success: false,
      error: 'Failed to revoke invite',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
