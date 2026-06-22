'use server'

import { api } from '@/src/libs/api/client'

export async function adminResetUserPassword(userId: string) {
  const result = await api.post(`/users/${userId}/password/reset`, {})

  if (!result.success) {
    return {
      success: false,
      error: result.error ?? 'Failed to send password reset email.',
    }
  }

  return { success: true }
}
