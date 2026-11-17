'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Building2 } from 'lucide-react'
import FirstLoginEmailStep from './_components/FirstLoginEmailStep'
import FirstLoginPasswordStep from './_components/FirstLoginPasswordStep'

/**
 * "First sign in?" from the sign-in page. Step 1 asks only for the email and
 * the system says what to do; step 2 (only for an email with no password yet)
 * asks for the new password twice and signs the person in.
 */
export default function FirstLoginPage() {
  const [email, setEmail] = useState<string | null>(null)

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12"
      style={{
        background: 'linear-gradient(135deg, #3b0764 0%, #5b21b6 40%, #6d28d9 70%, #7c3aed 100%)',
      }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-48 -left-48 h-150 w-150 rounded-full opacity-30"
          style={{ background: 'radial-gradient(circle, #a855f7 0%, transparent 70%)' }}
        />
        <div
          className="absolute -bottom-40 -right-32 h-120 w-120 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #818cf8 0%, transparent 70%)' }}
        />
      </div>

      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl bg-white px-8 py-10 shadow-2xl shadow-violet-950/50 sm:px-10">
        <div className="mb-8 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600">
            <Building2 className="h-4.5 w-4.5 text-white" />
          </div>
          <span className="text-sm font-semibold text-gray-900">Prominent</span>
        </div>

        {email === null ? (
          <FirstLoginEmailStep onSetPassword={setEmail} />
        ) : (
          <FirstLoginPasswordStep email={email} onBack={() => setEmail(null)} />
        )}

        <div className="mt-8 border-t border-gray-100 pt-6">
          <p className="text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link href="/login" className="font-semibold text-violet-600 hover:text-violet-700">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
