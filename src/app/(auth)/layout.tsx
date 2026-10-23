import { getSessionOrNull } from '@/src/libs/auth/actions'
import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Authentication - NIG Central',
  description: 'Login and authentication for NIG Central',
}

export default async function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  let session = null
  try {
    session = await getSessionOrNull()
  } catch {
    // If the session check fails (rate limit, expired token, network error),
    // fall through and render the auth page rather than crashing.
  }
  if (session) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen">
      <main className="min-h-screen w-full">{children}</main>
    </div>
  )
}
