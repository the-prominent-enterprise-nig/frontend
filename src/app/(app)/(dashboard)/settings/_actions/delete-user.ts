'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'

/** DELETE /users/:id. The backend keeps the record and deactivates it, so
 * the person can no longer sign in. */
export async function deleteUser(userId: string): Promise<ApiResponse> {
  try {
    const response = await api.delete(`/users/${userId}`)

    if (!response.success) {
      return {
        success: false,
        error: response.error || 'Failed to delete user',
        message: response.message,
      }
    }

    revalidatePath('/settings/users')
    return { success: true }
  } catch (error) {
    console.error('Error deleting user:', error)
    return {
      success: false,
      error: 'Failed to delete user',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
