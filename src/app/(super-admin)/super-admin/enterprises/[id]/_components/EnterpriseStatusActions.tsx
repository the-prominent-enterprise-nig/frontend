'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

interface Props {
  enterpriseId: string
  currentStatus: string
  enterpriseName: string
}

export function EnterpriseStatusActions({ enterpriseId, currentStatus, enterpriseName }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [confirm, setConfirm] = useState<'activate' | 'revoke' | 'remove' | null>(null)

  const isPending = currentStatus === 'pending'
  const isActive = currentStatus === 'active'
  const isSuspended = currentStatus === 'suspended'
  const isRevoked = currentStatus === 'revoked'
  const isClosed = currentStatus === 'closed'

  async function updateStatus(status: string) {
    setLoading(true)
    try {
      const res = await fetch(`/api/super-admin/enterprises/${enterpriseId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) {
        const data = (await res.json()) as { message?: string }
        throw new Error(data.message ?? 'Failed to update status')
      }
      const label =
        status === 'active'
          ? 'activated'
          : status === 'suspended'
            ? 'suspended'
            : status === 'revoked'
              ? 'revoked'
              : 'removed'
      toast.success(`Business ${label}`)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (isClosed) {
    return <p className="text-sm text-zinc-400">This business has been removed.</p>
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        {/* Pending: Activate + Remove only */}
        {isPending && (
          <>
            <button
              onClick={() => setConfirm('activate')}
              disabled={loading}
              className="w-full rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              Activate
            </button>
            <button
              onClick={() => setConfirm('remove')}
              disabled={loading}
              className="w-full rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              Remove
            </button>
          </>
        )}

        {/* Active: Suspend + Revoke + Remove */}
        {isActive && (
          <>
            <button
              onClick={() => updateStatus('suspended')}
              disabled={loading}
              className="w-full rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
            >
              Suspend
            </button>
            <button
              onClick={() => setConfirm('revoke')}
              disabled={loading}
              className="w-full rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              Revoke Access
            </button>
          </>
        )}

        {/* Suspended: Activate + Revoke */}
        {isSuspended && (
          <>
            <button
              onClick={() => setConfirm('activate')}
              disabled={loading}
              className="w-full rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              Activate
            </button>
            <button
              onClick={() => setConfirm('revoke')}
              disabled={loading}
              className="w-full rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              Revoke Access
            </button>
          </>
        )}

        {/* Revoked: Activate + Remove */}
        {isRevoked && (
          <>
            <button
              onClick={() => setConfirm('activate')}
              disabled={loading}
              className="w-full rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              Activate
            </button>
            <button
              onClick={() => setConfirm('remove')}
              disabled={loading}
              className="w-full rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              Remove
            </button>
          </>
        )}
      </div>

      {/* Activate confirmation */}
      {confirm === 'activate' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl">
            <h2 className="mb-2 text-base font-semibold text-zinc-900">Activate Business</h2>
            <p className="mb-6 text-sm text-zinc-600">
              By activating <strong className="text-zinc-900">{enterpriseName}</strong>, you are
              granting this business and its users full access to the platform based on their
              assigned modules and subscription plan. Make sure the account details and modules have
              been reviewed before proceeding.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirm(null)}
                disabled={loading}
                className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setConfirm(null)
                  await updateStatus('active')
                }}
                disabled={loading}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {loading ? 'Activating…' : 'Activate Business'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revoke confirmation */}
      {confirm === 'revoke' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl">
            <h2 className="mb-2 text-base font-semibold text-zinc-900">Revoke Access</h2>
            <p className="mb-6 text-sm text-zinc-600">
              Are you sure you want to revoke access for{' '}
              <strong className="text-zinc-900">{enterpriseName}</strong>? Users will immediately
              lose access to the platform.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirm(null)}
                disabled={loading}
                className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setConfirm(null)
                  await updateStatus('revoked')
                }}
                disabled={loading}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? 'Revoking…' : 'Revoke Access'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove confirmation */}
      {confirm === 'remove' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl">
            <h2 className="mb-2 text-base font-semibold text-zinc-900">Remove Business</h2>
            <p className="mb-6 text-sm text-zinc-600">
              Are you sure you want to remove{' '}
              <strong className="text-zinc-900">{enterpriseName}</strong>? This will permanently
              close the account.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirm(null)}
                disabled={loading}
                className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setConfirm(null)
                  await updateStatus('closed')
                }}
                disabled={loading}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
