'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { login } from '@/src/libs/auth/actions/login'
import { LoginSchema, type LoginInput } from '@/src/schema/auth/login'

interface LoginFormProps {
  sessionExpired?: boolean
}

export default function LoginForm({ sessionExpired }: LoginFormProps) {
  const router = useRouter()
  const [submitError, setSubmitError] = useState<string | null>(null)

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    mode: 'onSubmit',
    resolver: zodResolver(LoginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  const onSubmit = async (data: LoginInput) => {
    setSubmitError(null)
    const result = await login(data)

    if (!result.success) {
      setSubmitError(result.error ?? 'Unable to sign in')
      return
    }

    router.push('/')
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold text-zinc-900">Sign in</h1>
      <p className="mt-1 text-sm text-zinc-600">Enter your credentials to access the app.</p>

      {sessionExpired && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
          Your session has expired. Please sign in again.
        </div>
      )}

      <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <Controller
          name="email"
          control={control}
          render={({ field }) => (
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-zinc-700">
                Email
              </label>
              <input
                {...field}
                id="email"
                type="email"
                autoComplete="email"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none ring-prominent-orange-500 transition focus:border-transparent focus:ring-2"
                placeholder="you@company.com"
              />
              {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
            </div>
          )}
        />

        <Controller
          name="password"
          control={control}
          render={({ field }) => (
            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-zinc-700">
                Password
              </label>
              <input
                {...field}
                id="password"
                type="password"
                autoComplete="current-password"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none ring-prominent-orange-500 transition focus:border-transparent focus:ring-2"
                placeholder="Enter your password"
              />
              {errors.password && (
                <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
              )}
            </div>
          )}
        />

        {submitError && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {submitError}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-prominent-orange-500 px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-prominent-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
