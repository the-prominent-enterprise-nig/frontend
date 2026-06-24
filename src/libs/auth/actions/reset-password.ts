'use server'

import { api } from '@/src/libs/api/client'

export async function confirmPasswordReset(token: string, newPassword: string) {
  const result = await api.post('/auth/password/reset/confirm', { token, newPassword })

  if (!result.success) {
    return {
      success: false,
      error: result.error ?? 'Something went wrong. Please try again.',
    }
  }

  return { success: true }
}
