'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, Mail } from 'lucide-react'
import { checkFirstLogin, type FirstLoginStatus } from '@/src/libs/auth/actions/first-login'
import { FirstLoginEmailSchema, type FirstLoginEmailInput } from '@/src/schema/auth/first-login'
import { cn } from '@/src/libs/tailwind-merge/utils'

interface FirstLoginEmailStepProps {
  /** The email has no password yet: move on to choosing one. */
  onSetPassword: (email: string) => void
}

// What each answer from the system tells the person. `set_password` has no
// message because it moves on to the next step.
const MESSAGES: Record<Exclude<FirstLoginStatus, 'set_password'>, string> = {
  has_account: 'You already have an account. Sign in with your password.',
  not_found: "We couldn't find that email in the system. Check the spelling and try again.",
  unavailable:
    "First sign in isn't open for this email. Ask your Business Owner for an invite link.",
}

export default function FirstLoginEmailStep({ onSetPassword }: FirstLoginEmailStepProps) {
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [status, setStatus] = useState<Exclude<FirstLoginStatus, 'set_password'> | null>(null)

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FirstLoginEmailInput>({
    mode: 'onSubmit',
    resolver: zodResolver(FirstLoginEmailSchema),
    defaultValues: { email: '' },
  })

  const onSubmit = async (data: FirstLoginEmailInput) => {
    setSubmitError(null)
    setStatus(null)
    try {
      const result = await checkFirstLogin(data.email)
      if (!result.success) {
        setSubmitError(result.error)
        return
      }
      if (result.status === 'set_password') {
        onSetPassword(data.email.trim())
        return
      }
      setStatus(result.status)
    } catch {
      setSubmitError('Unable to check your email. Please refresh and try again.')
    }
  }

  return (
    <>
      <div className="mb-7">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-violet-500">
          First sign in
        </p>
        <h1 className="mt-1.5 text-2xl font-bold text-gray-900">Set up your password</h1>
        <p className="mt-1 text-sm text-gray-500">
          Enter the email your administrator has on file for you.
        </p>
      </div>

      <form className="space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Controller
          name="email"
          control={control}
          render={({ field }) => (
            <div className="space-y-1.5">
              <label htmlFor="fl-email" className="block text-xs font-semibold text-gray-700">
                Email address
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  {...field}
                  id="fl-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  className={cn(
                    'w-full rounded-xl border bg-gray-50 py-2.5 pl-10 pr-4 text-sm text-gray-900 outline-none transition-all',
                    'placeholder:text-gray-400',
                    'focus:border-violet-400 focus:bg-white focus:ring-3 focus:ring-violet-100',
                    errors.email
                      ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                      : 'border-gray-200'
                  )}
                />
              </div>
              {errors.email && (
                <p className="flex items-center gap-1 text-xs text-red-600">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  {errors.email.message}
                </p>
              )}
            </div>
          )}
        />

        {status && (
          <div
            role="status"
            data-testid={`first-login-${status}`}
            className="flex items-start gap-2.5 rounded-xl border border-violet-100 bg-violet-50 px-4 py-3"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
            <p className="text-sm text-violet-900">
              {MESSAGES[status]}
              {status === 'has_account' && (
                <>
                  {' '}
                  <Link href="/login" className="font-semibold underline">
                    Go to sign in
                  </Link>
                </>
              )}
            </p>
          </div>
        )}

        {submitError && (
          <div
            role="alert"
            data-testid="first-login-error"
            className="flex items-start gap-2.5 rounded-xl border border-red-100 bg-red-50 px-4 py-3"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
            <p className="text-sm text-red-700">{submitError}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className={cn(
            'w-full rounded-xl py-3 text-sm font-semibold text-white transition-all',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-60',
            !isSubmitting && 'hover:shadow-lg hover:shadow-violet-200 active:scale-[0.99]'
          )}
          style={{
            background: 'linear-gradient(135deg, #6d28d9 0%, #7c3aed 50%, #8b5cf6 100%)',
          }}
        >
          {isSubmitting ? 'Checking…' : 'Continue'}
        </button>
      </form>
    </>
  )
}
