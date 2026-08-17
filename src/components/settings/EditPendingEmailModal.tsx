'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { type User } from '@/src/schema/settings/list'
import { editPendingEmail } from '@/src/app/(app)/(dashboard)/settings/_actions/edit-pending-email'
import { showToast } from '@/src/components/ui/toast'

type Props = {
  user: User
  isOpen: boolean
  onClose: () => void
}

export default function EditPendingEmailModal({ user, isOpen, onClose }: Props) {
  const router = useRouter()
  const [email, setEmail] = useState(user.email)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleClose = () => {
    setEmail(user.email)
    setError(null)
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email)) {
      setError('Enter a valid email address')
      return
    }

    setIsSubmitting(true)
    const result = await editPendingEmail(user.id, email.trim())
    setIsSubmitting(false)

    if (!result.success) {
      showToast({
        title: 'Failed to update email',
        description: result.error ?? 'Please try again.',
        status: 'error',
      })
      return
    }

    showToast({
      title: 'Invite resent',
      description: `A fresh invite was sent to ${email.trim()}.`,
      status: 'success',
    })
    onClose()
    router.refresh()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-zinc-900">Correct Invite Email</h2>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5">
          <label className="mb-1 block text-sm font-medium text-zinc-700">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition ${
              error
                ? 'border-red-400 focus:border-red-500'
                : 'border-zinc-200 focus:border-zinc-400'
            }`}
            autoFocus
          />
          {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
          <p className="mt-2 text-xs text-zinc-400">
            Saving sends a fresh invite to the new address and invalidates the old link.
          </p>

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-prominent-purple-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? 'Sending…' : 'Save & Resend'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
