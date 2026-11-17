'use server'

import { cookies } from 'next/headers'
import {
  FirstLoginEmailSchema,
  FirstLoginSchema,
  type FirstLoginInput,
} from '@/src/schema/auth/first-login'
import { api } from '@/src/libs/api/client'

export type FirstLoginStatus = 'set_password' | 'has_account' | 'not_found' | 'unavailable'

interface LoginResponse {
  access_token: string
  user: { id: string; isSuperAdmin?: boolean }
}

/**
 * Step 1 of "First sign in?": what to show for this email. The backend answers
 * `unavailable` whenever first sign in is closed or not open for the email.
 */
export async function checkFirstLogin(email: string) {
  const parsed = FirstLoginEmailSchema.safeParse({ email })
  if (!parsed.success) {
    return {
      success: false as const,
      error: parsed.error.issues[0]?.message ?? 'Please enter a valid email address',
    }
  }

  const result = await api.post<{ status: FirstLoginStatus }>('/auth/first-login/check', {
    email: parsed.data.email,
  })
  if (!result.success || !result.data?.status) {
    return {
      success: false as const,
      error: result.error ?? 'Something went wrong. Please try again.',
    }
  }
  return { success: true as const, status: result.data.status }
}

/**
 * Step 2: someone who has never had a password creates it here and is signed
 * in. The backend only allows this during the announced window, for accounts
 * with no password and no invite link.
 */
export async function createFirstPassword(input: FirstLoginInput) {
  const parsed = FirstLoginSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false as const,
      error: parsed.error.issues[0]?.message ?? 'Invalid input',
    }
  }

  const result = await api.post<LoginResponse>('/auth/first-login', {
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (!result.success || !result.data?.access_token) {
    // A refusal the backend words for people (already has a password, password
    // policy, not available) is shown as it is; a bare server error is not.
    const message =
      result.error && !/internal server error/i.test(result.error)
        ? result.error
        : "We couldn't set your password right now. Please try again in a moment, or ask your Business Owner for an invite link."
    return { success: false as const, error: message }
  }

  const cookieStore = await cookies()
  cookieStore.set('authToken', result.data.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24, // 24h — matches the JWT expiry set in auth.module.ts
  })

  const redirectTo = result.data.user?.isSuperAdmin ? '/super-admin/dashboard' : '/'
  return { success: true as const, redirectTo }
}
