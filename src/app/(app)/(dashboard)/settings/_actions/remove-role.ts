'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'

export async function removeRole(userId: string, roleId: string): Promise<ApiResponse> {
  try {
    const response = await api.delete(`/users/${userId}/roles/${roleId}`)

    if (!response.success) {
      return {
        success: false,
        error: response.error || 'Failed to remove role',
        message: response.message,
      }
    }

    revalidatePath('/settings')
    revalidatePath('/settings/users')
    return { success: true }
  } catch (error) {
    console.error('Error removing role:', error)
    return {
      success: false,
      error: 'Failed to remove role',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
