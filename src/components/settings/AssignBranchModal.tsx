'use client'

import { X } from 'lucide-react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { type User } from '@/src/schema/settings/list'
import { assignBranch } from '@/src/app/(app)/(dashboard)/settings/_actions/assign-branch'
import { removeBranch } from '@/src/app/(app)/(dashboard)/settings/_actions/remove-branch'
import { showToast } from '@/src/components/ui/toast'

type AssignBranchModalProps = {
  user: User
  availableBranches: { id: string; name: string }[]
  isOpen: boolean
  onClose: () => void
}

export default function AssignBranchModal({
  user,
  availableBranches,
  isOpen,
  onClose,
}: AssignBranchModalProps) {
  const router = useRouter()
  const [selectedBranchId, setSelectedBranchId] = useState<string>('')
  const [isAssigning, setIsAssigning] = useState(false)
  const [removingBranchId, setRemovingBranchId] = useState<string | null>(null)

  const currentBranchIds = new Set(user.userBranches.map((ub) => ub.branch.id))

  const handleRemove = async (branchId: string, branchName: string) => {
    setRemovingBranchId(branchId)
    try {
      const result = await removeBranch(user.id, branchId)
      if (!result.success) {
        showToast({
          title: 'Failed to remove branch',
          description: result.error ?? 'Please try again.',
          status: 'error',
        })
        return
      }
      showToast({
        title: 'Branch removed',
        description: `${branchName} has been removed from ${user.email}.`,
        status: 'success',
      })
      router.refresh()
      onClose()
    } catch (error) {
      showToast({
        title: 'Failed to remove branch',
        description: error instanceof Error ? error.message : 'Unknown error',
        status: 'error',
      })
    } finally {
      setRemovingBranchId(null)
    }
  }

  const handleAssign = async () => {
    if (!selectedBranchId) {
      showToast({
        title: 'No branch selected',
        description: 'Please select a branch to assign',
        status: 'error',
      })
      return
    }

    setIsAssigning(true)

    try {
      const result = await assignBranch({
        userId: user.id,
        branchId: selectedBranchId,
      })

      if (!result.success) {
        showToast({
          title: 'Failed to assign branch',
          description: result.message || result.error,
          status: 'error',
        })
        return
      }

      showToast({
        title: 'Branch assigned',
        description: result.message || 'Branch has been successfully assigned to the user',
        status: 'success',
      })

      // Refresh server data and close modal
      router.refresh()
      onClose()
    } catch (error) {
      showToast({
        title: 'Failed to assign branch',
        description: error instanceof Error ? error.message : 'Unknown error',
        status: 'error',
      })
    } finally {
      setIsAssigning(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="flex w-full max-w-md flex-col rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Assign Branch</h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              User: <span className="font-medium text-zinc-700">{user.email}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {/* Current branches */}
          <div className="mb-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Current Branches
            </p>
            {user.userBranches.length === 0 ? (
              <p className="text-sm text-zinc-500">No branch access assigned yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {user.userBranches.map((ub) => (
                  <span
                    key={ub.branch.id}
                    className="inline-flex items-center gap-1.5 rounded-full bg-prominent-purple-100 pl-3 pr-1.5 py-1 text-xs font-medium text-prominent-purple-700"
                  >
                    {ub.branch.name}
                    <button
                      type="button"
                      disabled={removingBranchId === ub.branch.id}
                      onClick={() => handleRemove(ub.branch.id, ub.branch.name)}
                      className="flex h-4 w-4 items-center justify-center rounded-full text-prominent-purple-500 transition hover:bg-prominent-purple-200 hover:text-prominent-purple-800 disabled:opacity-50"
                      title={`Remove ${ub.branch.name}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Branch selection */}
          <div>
            <label htmlFor="branch-select" className="mb-2 block text-sm font-medium text-zinc-700">
              Select Branch to Assign
            </label>
            <select
              id="branch-select"
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
            >
              <option value="">-- Choose a branch --</option>
              {availableBranches.map((branch) => (
                <option
                  key={branch.id}
                  value={branch.id}
                  disabled={currentBranchIds.has(branch.id)}
                >
                  {branch.name}
                  {currentBranchIds.has(branch.id) ? ' (already assigned)' : ''}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-zinc-500">
              Note: Users can have access to multiple branches
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-zinc-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleAssign}
            disabled={isAssigning || !selectedBranchId}
            className="rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-prominent-purple-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isAssigning ? 'Assigning...' : 'Assign Branch'}
          </button>
        </div>
      </div>
    </div>
  )
}
