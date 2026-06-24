'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { login } from '@/src/libs/auth/actions/login'
import { LoginSchema, type LoginInput } from '@/src/schema/auth/login'
import Link from 'next/link'
import {
  AlertCircle,
  Briefcase,
  Building2,
  CalendarDays,
  DollarSign,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { cn } from '@/src/libs/tailwind-merge/utils'

export default function LoginPage() {
  const router = useRouter()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    mode: 'onSubmit',
    resolver: zodResolver(LoginSchema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = async (data: LoginInput) => {
    setSubmitError(null)

    try {
      const result = await login(data)

      if (!result?.success) {
        setSubmitError(result?.error ?? 'Unable to sign in')
        return
      }

      router.push(result.redirectTo ?? '/')
    } catch {
      setSubmitError('Unable to sign in. Please refresh and try again.')
    }
  }

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12"
      style={{
        background: 'linear-gradient(135deg, #3b0764 0%, #5b21b6 40%, #6d28d9 70%, #7c3aed 100%)',
      }}
    >
      {/* ── Decorative background blobs ─────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Large glow top-left */}
        <div
          className="absolute -top-48 -left-48 h-150 w-150 rounded-full opacity-30"
          style={{ background: 'radial-gradient(circle, #a855f7 0%, transparent 70%)' }}
        />
        {/* Medium glow bottom-right */}
        <div
          className="absolute -bottom-40 -right-32 h-120 w-120 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #818cf8 0%, transparent 70%)' }}
        />
        {/* Small accent center-right */}
        <div
          className="absolute top-1/3 right-1/4 h-64 w-64 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #e879f9 0%, transparent 70%)' }}
        />
        {/* Dot grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />
      </div>

      {/* ── Card ────────────────────────────────────────────────────────── */}
      <div className="relative z-10 w-full max-w-4xl overflow-hidden rounded-3xl shadow-2xl shadow-violet-950/50 lg:flex">
        {/* ── Left panel ──────────────────────────────────────────────── */}
        <div
          className="relative hidden overflow-hidden lg:flex lg:w-[48%] lg:flex-col lg:justify-between p-10"
          style={{
            background:
              'linear-gradient(160deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 100%)',
          }}
        >
          {/* Glass shimmer border */}
          <div className="absolute inset-0 rounded-l-3xl ring-1 ring-inset ring-white/10 pointer-events-none" />

          {/* Decorative circle behind content */}
          <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full border border-white/5 bg-white/2" />
          <div className="absolute -bottom-12 -right-12 h-48 w-48 rounded-full border border-white/5 bg-white/2" />

          {/* Logo */}
          <div className="relative flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20 backdrop-blur-sm">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-base font-700 font-semibold leading-none text-white">Prominent</p>
              <p className="text-[10px] text-violet-300/80 leading-none mt-0.5">Enterprise Suite</p>
            </div>
          </div>

          {/* Headline */}
          <div className="relative space-y-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/15">
                <ShieldCheck className="h-3 w-3 text-violet-200" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-violet-200">
                  Trusted Platform
                </span>
              </div>
              <h2 className="text-3xl font-bold leading-tight text-white">
                Your business,
                <br />
                <span className="text-violet-200">fully in control.</span>
              </h2>
              <p className="text-sm font-light leading-relaxed text-violet-300/80">
                Manage HR, payroll, inventory, accounting, and CRM — all from a single unified
                workspace.
              </p>
            </div>

            {/* Feature tiles */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: Users, label: 'HR & Payroll' },
                { icon: DollarSign, label: 'Accounting' },
                { icon: Briefcase, label: 'Procurement' },
                { icon: CalendarDays, label: 'Attendance' },
              ].map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-2.5 rounded-xl bg-white/8 px-3 py-2.5 ring-1 ring-white/10"
                >
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white/15">
                    <Icon className="h-3.5 w-3.5 text-white" />
                  </div>
                  <span className="text-xs font-medium text-white/90">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <p className="relative text-[10px] text-violet-400/50">
            © {new Date().getFullYear()} Prominent Enterprise
          </p>
        </div>

        {/* ── Right form panel ────────────────────────────────────────── */}
        <div className="flex flex-1 flex-col justify-center bg-white px-8 py-10 sm:px-10">
          {/* Mobile logo */}
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600">
              <Building2 className="h-4.5 w-4.5 text-white" />
            </div>
            <span className="text-sm font-semibold text-gray-900">Prominent</span>
          </div>

          {/* Heading */}
          <div className="mb-7">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-violet-500">
              Welcome back
            </p>
            <h1 className="mt-1.5 text-2xl font-bold text-gray-900">Sign in to your account</h1>
            <p className="mt-1 text-sm text-gray-500">
              Enter your credentials to access your workspace.
            </p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
            {/* Email */}
            <Controller
              name="email"
              control={control}
              render={({ field }) => (
                <div className="space-y-1.5">
                  <label htmlFor="email" className="block text-xs font-semibold text-gray-700">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      {...field}
                      id="email"
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

            {/* Password */}
            <Controller
              name="password"
              control={control}
              render={({ field }) => (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="password" className="block text-xs font-semibold text-gray-700">
                      Password
                    </label>
                    <Link
                      href="/forgot-password"
                      className="text-xs font-medium text-violet-600 hover:text-violet-700 transition-colors"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      {...field}
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      className={cn(
                        'w-full rounded-xl border bg-gray-50 py-2.5 pl-10 pr-10 text-sm text-gray-900 outline-none transition-all',
                        'placeholder:text-gray-400',
                        'focus:border-violet-400 focus:bg-white focus:ring-3 focus:ring-violet-100',
                        errors.password
                          ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                          : 'border-gray-200'
                      )}
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
                  {errors.password && (
                    <p className="flex items-center gap-1 text-xs text-red-600">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      {errors.password.message}
                    </p>
                  )}
                </div>
              )}
            />

            {/* Submit error */}
            {submitError && (
              <div className="flex items-start gap-2.5 rounded-xl border border-red-100 bg-red-50 px-4 py-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                <p className="text-sm text-red-700">{submitError}</p>
              </div>
            )}

            {/* Submit button */}
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
                  Signing in…
                </span>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          <div className="mt-8 border-t border-gray-100 pt-6">
            <p className="text-center text-xs text-gray-400">
              Having trouble accessing your account?{' '}
              <span className="cursor-default font-medium text-violet-600">
                Contact your administrator.
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
