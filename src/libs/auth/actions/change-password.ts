'use server'

import { api } from '@/src/libs/api/client'
import { ChangePasswordSchema, type ChangePasswordInput } from '@/src/schema/auth/change-password'

export async function changePassword(input: ChangePasswordInput) {
  const parsed = ChangePasswordSchema.safeParse(input)

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    return {
      success: false,
      error: firstIssue?.message ?? 'Invalid input',
    }
  }

  const result = await api.patch('/auth/password', {
    currentPassword: parsed.data.currentPassword,
    newPassword: parsed.data.newPassword,
  })

  if (!result.success) {
    const isWrongPassword =
      result.error?.toLowerCase().includes('incorrect') ||
      result.error?.toLowerCase().includes('unauthorized') ||
      result.error?.toLowerCase().includes('401')
    return {
      success: false,
      error: isWrongPassword
        ? 'Current password is incorrect'
        : (result.error ?? 'Failed to update password. Please try again.'),
    }
  }

  return { success: true }
}
