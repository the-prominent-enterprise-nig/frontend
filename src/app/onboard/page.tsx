import { notFound } from 'next/navigation'
import { Building2, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { OnboardForm } from './_components/OnboardForm'

const API_URL = (process.env.API_URL ?? 'http://localhost:3001').replace(/\/$/, '')

interface TokenData {
  valid: boolean
  expired: boolean
  used: boolean
  businessName: string
  email: string
}

async function getInvite(token: string): Promise<TokenData | null> {
  try {
    const res = await fetch(`${API_URL}/auth/invite/${token}`, { cache: 'no-store' })
    if (res.status === 404) return null
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export default async function OnboardPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams

  if (!token) return notFound()

  const invite = await getInvite(token)

  if (!invite) return notFound()

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600">
            <Building2 className="h-6 w-6 text-white" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
            Prominent Enterprise
          </p>
        </div>

        {/* Already used */}
        {invite.used && (
          <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
            <CheckCircle2 className="mx-auto mb-4 h-10 w-10 text-emerald-500" />
            <h1 className="text-lg font-semibold text-zinc-900">Account already activated</h1>
            <p className="mt-2 text-sm text-zinc-500">
              This invite has already been used. Please sign in to access your workspace.
            </p>
            <a
              href="/login"
              className="mt-6 inline-block rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Sign in
            </a>
          </div>
        )}

        {/* Expired */}
        {invite.expired && !invite.used && (
          <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
            <AlertTriangle className="mx-auto mb-4 h-10 w-10 text-amber-500" />
            <h1 className="text-lg font-semibold text-zinc-900">Invite link expired</h1>
            <p className="mt-2 text-sm text-zinc-500">
              This invite link is no longer valid. Please ask your platform administrator to
              generate a new one.
            </p>
          </div>
        )}

        {/* Valid — show setup form */}
        {invite.valid && (
          <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-100 px-8 py-6">
              <h1 className="text-xl font-bold text-zinc-900">Set up your account</h1>
              <p className="mt-1 text-sm text-zinc-500">
                You&apos;ve been invited to manage{' '}
                <span className="font-semibold text-zinc-700">{invite.businessName}</span>. Complete
                the form below to activate your account.
              </p>
            </div>

            <div className="px-8 py-6">
              {/* Email (read-only) */}
              <div className="mb-5">
                <label className="mb-1.5 block text-xs font-medium text-zinc-500">
                  Email address
                </label>
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-500">
                  {invite.email}
                </div>
              </div>

              <OnboardForm token={token} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
