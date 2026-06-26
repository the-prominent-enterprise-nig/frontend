'use server'

import { api } from '@/src/libs/api/client'
import { ForgotPasswordSchema, type ForgotPasswordInput } from '@/src/schema/auth/forgot-password'

export async function requestPasswordReset(input: ForgotPasswordInput) {
  const parsed = ForgotPasswordSchema.safeParse(input)

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    return {
      success: false,
      error: firstIssue?.message ?? 'Invalid input',
    }
  }

  const result = await api.post('/auth/password/reset', { email: parsed.data.email })

  if (!result.success) {
    return {
      success: false,
      error: result.error ?? 'Something went wrong. Please try again.',
    }
  }

  return { success: true }
}
