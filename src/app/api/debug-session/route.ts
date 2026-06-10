import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(_req: NextRequest) {
  const cookieStore = await cookies()
  const authToken = cookieStore.get('authToken')?.value

  if (!authToken) {
    return NextResponse.json({ error: 'No authToken cookie found' }, { status: 401 })
  }

  const apiUrl = process.env.API_URL
  if (!apiUrl) {
    return NextResponse.json({ error: 'API_URL not configured' }, { status: 500 })
  }

  const res = await fetch(`${apiUrl}/users/me`, {
    headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
    cache: 'no-store',
  })

  const raw = await res.json()
  return NextResponse.json({ status: res.status, raw }, { status: 200 })
}
