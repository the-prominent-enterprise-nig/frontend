'use server'

import { cookies } from 'next/headers'

const API_URL = (process.env.API_URL ?? 'http://localhost:3001').replace(/\/$/, '')

export async function claimInvite(
  token: string,
  dto: { firstName: string; lastName: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/auth/invite/${token}/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
      cache: 'no-store',
    })

    if (!res.ok) {
      const data = (await res.json()) as { message?: string | string[] }
      const msg = Array.isArray(data.message)
        ? data.message.join(', ')
        : (data.message ?? 'Failed to activate account')
      return { success: false, error: msg }
    }

    const data = (await res.json()) as { access_token: string }

    const cookieStore = await cookies()
    cookieStore.set('authToken', data.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24,
    })

    return { success: true }
  } catch {
    return { success: false, error: 'Unable to connect to the server. Please try again.' }
  }
}
