'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import { claimInvite } from '../actions'

interface Props {
  token: string
}

function Input({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  error,
  required,
  suffix,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  error?: string
  required?: boolean
  suffix?: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-zinc-500">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 ${error ? 'border-red-400' : 'border-zinc-200 focus:border-indigo-400'} ${suffix ? 'pr-10' : ''}`}
        />
        {suffix && <div className="absolute right-3 top-1/2 -translate-y-1/2">{suffix}</div>}
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}

export function OnboardForm({ token }: Props) {
  const router = useRouter()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  function validate() {
    const e: Record<string, string> = {}
    if (!firstName.trim()) e.firstName = 'First name is required'
    if (!lastName.trim()) e.lastName = 'Last name is required'
    if (!password) e.password = 'Password is required'
    else if (password.length < 8) e.password = 'Password must be at least 8 characters'
    if (password !== confirmPassword) e.confirmPassword = 'Passwords do not match'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setSubmitting(true)
    setServerError(null)

    const result = await claimInvite(token, {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      password,
    })

    if (!result.success) {
      setServerError(result.error ?? 'Something went wrong')
      setSubmitting(false)
      return
    }

    router.push('/dashboard')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="First Name"
          value={firstName}
          onChange={setFirstName}
          placeholder="Juan"
          error={errors.firstName}
          required
        />
        <Input
          label="Last Name"
          value={lastName}
          onChange={setLastName}
          placeholder="Dela Cruz"
          error={errors.lastName}
          required
        />
      </div>

      <Input
        label="Password"
        value={password}
        onChange={setPassword}
        type={showPassword ? 'text' : 'password'}
        placeholder="Min. 8 characters"
        error={errors.password}
        required
        suffix={
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="text-zinc-400 hover:text-zinc-600"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        }
      />

      <Input
        label="Confirm Password"
        value={confirmPassword}
        onChange={setConfirmPassword}
        type={showPassword ? 'text' : 'password'}
        placeholder="Re-enter your password"
        error={errors.confirmPassword}
        required
      />

      {serverError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {serverError}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="mt-2 w-full rounded-lg bg-indigo-600 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? 'Activating account…' : 'Activate Account'}
      </button>

      <p className="text-center text-xs text-zinc-400">
        By activating, you agree to the platform terms of service.
      </p>
    </form>
  )
}
