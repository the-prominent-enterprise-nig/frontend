'use server'

import { api, ApiResponse } from '@/src/libs/api/client'

type InviteLink = { inviteUrl: string; expiresAt: string; expired: boolean }

export async function getInviteLink(userId: string): Promise<ApiResponse<InviteLink>> {
  try {
    const response = await api.get<InviteLink>(`/users/${userId}/invite-link`)

    if (!response.success) {
      return {
        success: false,
        error: response.error || 'Failed to get invite link',
        message: response.message,
      }
    }

    return { success: true, data: response.data }
  } catch (error) {
    console.error('Error getting invite link:', error)
    return {
      success: false,
      error: 'Failed to get invite link',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
