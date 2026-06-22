'use client'

import { Suspense, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { confirmPasswordReset } from '@/src/libs/auth/actions/reset-password'
import { ResetPasswordSchema, type ResetPasswordInput } from '@/src/schema/auth/reset-password'
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  ShieldCheck,
} from 'lucide-react'
import { cn } from '@/src/libs/tailwind-merge/utils'

function ResetPasswordContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token') ?? ''

  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    mode: 'onChange',
    resolver: zodResolver(ResetPasswordSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  })

  if (!token) {
    return (
      <div
        className="flex min-h-screen items-center justify-center px-4"
        style={{
          background: 'linear-gradient(135deg, #3b0764 0%, #5b21b6 40%, #6d28d9 70%, #7c3aed 100%)',
        }}
      >
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-2xl">
          <div className="mb-4 flex h-14 w-14 mx-auto items-center justify-center rounded-full bg-red-50 ring-1 ring-red-100">
            <AlertCircle className="h-7 w-7 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Invalid reset link</h1>
          <p className="mt-2 text-sm text-gray-500">
            This link is missing a reset token. Please request a new one.
          </p>
          <Link
            href="/forgot-password"
            className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-violet-600 hover:text-violet-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Request new link
          </Link>
        </div>
      </div>
    )
  }

  const onSubmit = async (data: ResetPasswordInput) => {
    setSubmitError(null)
    try {
      const result = await confirmPasswordReset(token, data.newPassword)
      if (!result.success) {
        setSubmitError(result.error ?? 'Something went wrong. Please try again.')
        return
      }
      setSubmitted(true)
      setTimeout(() => router.push('/login'), 3000)
    } catch {
      setSubmitError('Unable to reset password. Please refresh and try again.')
    }
  }

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12"
      style={{
        background: 'linear-gradient(135deg, #3b0764 0%, #5b21b6 40%, #6d28d9 70%, #7c3aed 100%)',
      }}
    >
      {/* Decorative blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-48 -left-48 h-150 w-150 rounded-full opacity-30"
          style={{ background: 'radial-gradient(circle, #a855f7 0%, transparent 70%)' }}
        />
        <div
          className="absolute -bottom-40 -right-32 h-120 w-120 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #818cf8 0%, transparent 70%)' }}
        />
        <div
          className="absolute top-1/3 right-1/4 h-64 w-64 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #e879f9 0%, transparent 70%)' }}
        />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />
      </div>

      {/* Card */}
      <div className="relative z-10 w-full max-w-4xl overflow-hidden rounded-3xl shadow-2xl shadow-violet-950/50 lg:flex">
        {/* Left panel */}
        <div
          className="relative hidden overflow-hidden lg:flex lg:w-[48%] lg:flex-col lg:justify-between p-10"
          style={{
            background:
              'linear-gradient(160deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 100%)',
          }}
        >
          <div className="absolute inset-0 rounded-l-3xl ring-1 ring-inset ring-white/10 pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full border border-white/5 bg-white/2" />
          <div className="absolute -bottom-12 -right-12 h-48 w-48 rounded-full border border-white/5 bg-white/2" />

          <div className="relative flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20 backdrop-blur-sm">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-base font-semibold leading-none text-white">Prominent</p>
              <p className="text-[10px] text-violet-300/80 leading-none mt-0.5">Enterprise Suite</p>
            </div>
          </div>

          <div className="relative space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/15">
              <ShieldCheck className="h-3 w-3 text-violet-200" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-violet-200">
                Set New Password
              </span>
            </div>
            <h2 className="text-3xl font-bold leading-tight text-white">
              Create a new
              <br />
              <span className="text-violet-200">secure password</span>
            </h2>
            <p className="text-sm font-light leading-relaxed text-violet-300/80">
              Choose a strong password with at least 8 characters. Once set, you&apos;ll be
              redirected to sign in.
            </p>
            <div className="flex items-start gap-3 rounded-xl bg-white/8 px-4 py-3 ring-1 ring-white/10">
              <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" />
              <p className="text-xs leading-relaxed text-violet-200/80">
                This reset link is <strong className="text-white">single-use</strong> and expires
                after 24 hours.
              </p>
            </div>
          </div>

          <p className="relative text-[10px] text-violet-400/50">
            © {new Date().getFullYear()} Prominent Enterprise
          </p>
        </div>

        {/* Right form panel */}
        <div className="flex flex-1 flex-col justify-center bg-white px-8 py-10 sm:px-10">
          {/* Mobile logo */}
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600">
              <Building2 className="h-4.5 w-4.5 text-white" />
            </div>
            <span className="text-sm font-semibold text-gray-900">Prominent</span>
          </div>

          {submitted ? (
            <div className="flex flex-col items-center text-center">
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-green-50 ring-1 ring-green-100">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Password updated!</h1>
              <p className="mt-2 text-sm text-gray-500 leading-relaxed max-w-xs">
                Your password has been reset successfully. Redirecting you to sign in…
              </p>
              <Link
                href="/login"
                className="mt-8 flex items-center gap-1.5 text-sm font-medium text-violet-600 hover:text-violet-700 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Go to sign in
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-7">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-violet-500">
                  Password reset
                </p>
                <h1 className="mt-1.5 text-2xl font-bold text-gray-900">Set new password</h1>
                <p className="mt-1 text-sm text-gray-500">
                  Enter and confirm your new password below.
                </p>
              </div>

              <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
                {/* New password */}
                <Controller
                  name="newPassword"
                  control={control}
                  render={({ field }) => (
                    <div className="space-y-1.5">
                      <label
                        htmlFor="newPassword"
                        className="block text-xs font-semibold text-gray-700"
                      >
                        New password
                      </label>
                      <div className="relative">
                        <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <input
                          {...field}
                          id="newPassword"
                          type={showNew ? 'text' : 'password'}
                          placeholder="Min. 8 characters"
                          className={cn(
                            'w-full rounded-xl border bg-gray-50 py-2.5 pl-10 pr-10 text-sm text-gray-900 outline-none transition-all',
                            'placeholder:text-gray-400',
                            'focus:border-violet-400 focus:bg-white focus:ring-3 focus:ring-violet-100',
                            errors.newPassword
                              ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                              : 'border-gray-200'
                          )}
                        />
                        <button
                          type="button"
                          onClick={() => setShowNew((v) => !v)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          tabIndex={-1}
                        >
                          {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {errors.newPassword && (
                        <p className="flex items-center gap-1 text-xs text-red-600">
                          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                          {errors.newPassword.message}
                        </p>
                      )}
                    </div>
                  )}
                />

                {/* Confirm password */}
                <Controller
                  name="confirmPassword"
                  control={control}
                  render={({ field }) => (
                    <div className="space-y-1.5">
                      <label
                        htmlFor="confirmPassword"
                        className="block text-xs font-semibold text-gray-700"
                      >
                        Confirm password
                      </label>
                      <div className="relative">
                        <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <input
                          {...field}
                          id="confirmPassword"
                          type={showConfirm ? 'text' : 'password'}
                          placeholder="Re-enter new password"
                          className={cn(
                            'w-full rounded-xl border bg-gray-50 py-2.5 pl-10 pr-10 text-sm text-gray-900 outline-none transition-all',
                            'placeholder:text-gray-400',
                            'focus:border-violet-400 focus:bg-white focus:ring-3 focus:ring-violet-100',
                            errors.confirmPassword
                              ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                              : 'border-gray-200'
                          )}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirm((v) => !v)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          tabIndex={-1}
                        >
                          {showConfirm ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
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
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      Resetting password…
                    </span>
                  ) : (
                    'Reset password'
                  )}
                </button>
              </form>

              <div className="mt-8 border-t border-gray-100 pt-6">
                <Link
                  href="/login"
                  className="flex items-center justify-center gap-1.5 text-sm font-medium text-violet-600 hover:text-violet-700 transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to sign in
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordContent />
    </Suspense>
  )
}
