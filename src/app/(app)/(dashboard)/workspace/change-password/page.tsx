'use client'

import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { changePassword } from '@/src/libs/auth/actions/change-password'
import { ChangePasswordSchema, type ChangePasswordInput } from '@/src/schema/auth/change-password'
import { AlertCircle, CheckCircle2, Eye, EyeOff, KeyRound, Lock, ShieldCheck } from 'lucide-react'
import { cn } from '@/src/libs/tailwind-merge/utils'

export default function ChangePasswordPage() {
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordInput>({
    mode: 'onSubmit',
    resolver: zodResolver(ChangePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })

  const onSubmit = async (data: ChangePasswordInput) => {
    setSubmitError(null)
    setSuccess(false)
    try {
      const result = await changePassword(data)
      if (!result.success) {
        setSubmitError(result.error ?? 'Failed to update password.')
        return
      }
      setSuccess(true)
      reset()
    } catch {
      setSubmitError('Something went wrong. Please refresh and try again.')
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      {/* Page header */}
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100">
          <KeyRound className="h-5 w-5 text-violet-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Change Password</h1>
          <p className="text-sm text-gray-500">Update your account password</p>
        </div>
      </div>

      {/* Security note */}
      <div className="mb-6 flex items-start gap-3 rounded-xl border border-violet-100 bg-violet-50 px-4 py-3">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
        <p className="text-xs leading-relaxed text-violet-700">
          Your new password must be at least <strong>8 characters</strong>, include an uppercase
          letter and a number.
        </p>
      </div>

      {/* Success banner */}
      {success && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-green-100 bg-green-50 px-4 py-3">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
          <p className="text-sm font-medium text-green-700">Password updated successfully.</p>
        </div>
      )}

      {/* Form card */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
          {/* Current password */}
          <PasswordField
            name="currentPassword"
            control={control}
            label="Current password"
            show={showCurrent}
            onToggle={() => setShowCurrent((v) => !v)}
            error={errors.currentPassword?.message}
            autoComplete="current-password"
          />

          <div className="border-t border-gray-100" />

          {/* New password */}
          <PasswordField
            name="newPassword"
            control={control}
            label="New password"
            show={showNew}
            onToggle={() => setShowNew((v) => !v)}
            error={errors.newPassword?.message}
            autoComplete="new-password"
          />

          {/* Confirm password */}
          <PasswordField
            name="confirmPassword"
            control={control}
            label="Confirm new password"
            show={showConfirm}
            onToggle={() => setShowConfirm((v) => !v)}
            error={errors.confirmPassword?.message}
            autoComplete="new-password"
          />

          {/* Submit error */}
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
              'w-full rounded-xl py-2.5 text-sm font-semibold text-white transition-all',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-60',
              !isSubmitting && 'hover:shadow-md hover:shadow-violet-100 active:scale-[0.99]'
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
                Updating password…
              </span>
            ) : (
              'Update password'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}

/* ── Reusable password field ─────────────────────────────────────────────── */
function PasswordField({
  name,
  control,
  label,
  show,
  onToggle,
  error,
  autoComplete,
}: {
  name: keyof ChangePasswordInput
  control: ReturnType<typeof useForm<ChangePasswordInput>>['control']
  label: string
  show: boolean
  onToggle: () => void
  error?: string
  autoComplete?: string
}) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <div className="space-y-1.5">
          <label htmlFor={name} className="block text-xs font-semibold text-gray-700">
            {label}
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              {...field}
              id={name}
              type={show ? 'text' : 'password'}
              autoComplete={autoComplete}
              placeholder="••••••••"
              className={cn(
                'w-full rounded-xl border bg-gray-50 py-2.5 pl-10 pr-10 text-sm text-gray-900 outline-none transition-all',
                'placeholder:text-gray-400',
                'focus:border-violet-400 focus:bg-white focus:ring-3 focus:ring-violet-100',
                error ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : 'border-gray-200'
              )}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={onToggle}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-600"
              aria-label={show ? 'Hide password' : 'Show password'}
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {error && (
            <p className="flex items-center gap-1 text-xs text-red-600">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {error}
            </p>
          )}
        </div>
      )}
    />
  )
}
