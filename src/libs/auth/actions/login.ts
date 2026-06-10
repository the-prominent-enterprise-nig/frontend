'use server'

import { cookies } from 'next/headers'
import { revalidateTag } from 'next/cache'
import { LoginSchema, type LoginInput } from '@/src/schema/auth/login'
import { redirect } from 'next/navigation'
import { api } from '@/src/libs/api/client'

interface LoginResponse {
  access_token: string
  user: {
    id: string
    employeeId: string
    firstName: string
    lastName: string
    isSuperAdmin?: boolean
  }
}

export async function login(input: LoginInput) {
  const parsed = LoginSchema.safeParse(input)

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    return {
      success: false,
      error: firstIssue?.message ?? 'Invalid login input',
    }
  }

  const result = await api.post<LoginResponse>('/auth/login', {
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (!result.success || !result.data?.access_token) {
    const isUnauthorized =
      result.error?.toLowerCase().includes('401') ||
      result.error?.toLowerCase().includes('unauthorized') ||
      result.error?.toLowerCase().includes('invalid')
    return {
      success: false,
      error: isUnauthorized
        ? 'Invalid email or password'
        : (result.error ?? 'An unexpected error occurred. Please try again.'),
    }
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
  return { success: true, redirectTo }
}

export async function logout() {
  revalidateTag('user-session', 'max')
  const cookieStore = await cookies()
  cookieStore.delete('authToken')
}

export async function logoutAndRedirect() {
  await logout()
  redirect('/login')
}
