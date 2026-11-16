'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, ArrowLeft, Eye, EyeOff, Lock, Mail } from 'lucide-react'
import { createFirstPassword } from '@/src/libs/auth/actions/login'
import { FirstLoginSchema, type FirstLoginInput } from '@/src/schema/auth/first-login'
import { cn } from '@/src/libs/tailwind-merge/utils'

interface FirstLoginFormProps {
  /** Carried over from the sign-in form when it sent the person here. */
  initialEmail: string
  onBack: () => void
}

const inputClass = (hasError: boolean) =>
  cn(
    'w-full rounded-xl border bg-gray-50 py-2.5 pl-10 pr-10 text-sm text-gray-900 outline-none transition-all',
    'placeholder:text-gray-400',
    'focus:border-violet-400 focus:bg-white focus:ring-3 focus:ring-violet-100',
    hasError ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : 'border-gray-200'
  )

export default function FirstLoginForm({ initialEmail, onBack }: FirstLoginFormProps) {
  const router = useRouter()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FirstLoginInput>({
    mode: 'onSubmit',
    resolver: zodResolver(FirstLoginSchema),
    defaultValues: { email: initialEmail, password: '', confirmPassword: '' },
  })

  const onSubmit = async (data: FirstLoginInput) => {
    setSubmitError(null)
    try {
      const result = await createFirstPassword(data)
      if (!result?.success) {
        setSubmitError(result?.error ?? 'Unable to create your password')
        return
      }
      router.push(result.redirectTo ?? '/')
    } catch {
      setSubmitError('Unable to create your password. Please refresh and try again.')
    }
  }

  return (
    <>
      <div className="mb-7">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-violet-500">
          First time signing in
        </p>
        <h1 className="mt-1.5 text-2xl font-bold text-gray-900">Create your password</h1>
        <p className="mt-1 text-sm text-gray-500">
          Use the email your administrator has on file for you. You&apos;ll use this password every
          time you sign in.
        </p>
      </div>

      <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
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
                  className={inputClass(!!errors.email)}
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

        <Controller
          name="password"
          control={control}
          render={({ field }) => (
            <div className="space-y-1.5">
              <label htmlFor="fl-password" className="block text-xs font-semibold text-gray-700">
                New password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  {...field}
                  id="fl-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Create a password"
                  className={inputClass(!!errors.password)}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password ? (
                <p className="flex items-center gap-1 text-xs text-red-600">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  {errors.password.message}
                </p>
              ) : (
                <p className="text-xs text-gray-400">
                  At least 8 characters, with an uppercase letter, a lowercase letter, a number and
                  a special character.
                </p>
              )}
            </div>
          )}
        />

        <Controller
          name="confirmPassword"
          control={control}
          render={({ field }) => (
            <div className="space-y-1.5">
              <label
                htmlFor="fl-confirm-password"
                className="block text-xs font-semibold text-gray-700"
              >
                Confirm password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  {...field}
                  id="fl-confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Re-enter your password"
                  className={inputClass(!!errors.confirmPassword)}
                />
              </div>
              {errors.confirmPassword && (
                <p className="flex items-center gap-1 text-xs text-red-600">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>
          )}
        />

        {submitError && (
          <div className="flex items-start gap-2.5 rounded-xl border border-red-100 bg-red-50 px-4 py-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
            <p className="text-sm text-red-700">{submitError}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className={cn(
            'relative w-full overflow-hidden rounded-xl py-3 text-sm font-semibold text-white transition-all',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-60',
            !isSubmitting && 'hover:shadow-lg hover:shadow-violet-200 active:scale-[0.99]'
          )}
          style={{
            background: isSubmitting
              ? '#7c3aed'
              : 'linear-gradient(135deg, #6d28d9 0%, #7c3aed 50%, #8b5cf6 100%)',
          }}
        >
          {isSubmitting ? 'Creating your password…' : 'Create password and sign in'}
        </button>

        <button
          type="button"
          onClick={onBack}
          className="flex w-full items-center justify-center gap-1.5 text-xs font-medium text-violet-600 transition-colors hover:text-violet-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to sign in
        </button>
      </form>
    </>
  )
}
