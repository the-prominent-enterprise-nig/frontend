'use client'

import { X } from 'lucide-react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { type User, type Role } from '@/src/schema/settings/list'
import { assignRole } from '@/src/app/(app)/(dashboard)/settings/_actions/assign-role'
import { removeRole } from '@/src/app/(app)/(dashboard)/settings/_actions/remove-role'
import { showToast } from '@/src/components/ui/toast'

type AssignRoleModalProps = {
  user: User
  availableRoles: Role[]
  isOpen: boolean
  onClose: () => void
}

export default function AssignRoleModal({
  user,
  availableRoles,
  isOpen,
  onClose,
}: AssignRoleModalProps) {
  const router = useRouter()
  const [selectedRoleId, setSelectedRoleId] = useState<string>('')
  const [isAssigning, setIsAssigning] = useState(false)
  const [removingRoleId, setRemovingRoleId] = useState<string | null>(null)

  const currentRoleIds = new Set(user.userRoles.map((ur) => ur.role.id))

  const handleRemove = async (roleId: string, roleName: string) => {
    setRemovingRoleId(roleId)
    try {
      const result = await removeRole(user.id, roleId)
      if (!result.success) {
        showToast({
          title: 'Failed to remove role',
          description: result.error ?? 'Please try again.',
          status: 'error',
        })
        return
      }
      showToast({
        title: 'Role removed',
        description: `${roleName} has been removed from ${user.email}.`,
        status: 'success',
      })
      router.refresh()
      onClose()
    } catch (error) {
      showToast({
        title: 'Failed to remove role',
        description: error instanceof Error ? error.message : 'Unknown error',
        status: 'error',
      })
    } finally {
      setRemovingRoleId(null)
    }
  }

  const handleAssign = async () => {
    if (!selectedRoleId) {
      showToast({
        title: 'No role selected',
        description: 'Please select a role to assign',
        status: 'error',
      })
      return
    }

    setIsAssigning(true)

    try {
      const result = await assignRole({
        userId: user.id,
        roleId: selectedRoleId,
      })

      if (!result.success) {
        showToast({
          title: 'Failed to assign role',
          description: result.message || result.error,
          status: 'error',
        })
        return
      }

      showToast({
        title: 'Role assigned',
        description: result.message || 'Role has been successfully assigned to the user',
        status: 'success',
      })

      // Refresh server data and close modal
      router.refresh()
      onClose()
    } catch (error) {
      showToast({
        title: 'Failed to assign role',
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
            <h2 className="text-lg font-semibold text-zinc-900">Assign Role</h2>
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
          {/* Current roles */}
          <div className="mb-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Current Roles
            </p>
            {user.userRoles.length === 0 ? (
              <p className="text-sm text-zinc-500">No roles assigned yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {user.userRoles.map((ur) => (
                  <span
                    key={ur.role.id}
                    className="inline-flex items-center gap-1.5 rounded-full bg-prominent-purple-100 pl-3 pr-1.5 py-1 text-xs font-medium text-prominent-purple-700"
                  >
                    {ur.role.name}
                    <button
                      type="button"
                      disabled={removingRoleId === ur.role.id}
                      onClick={() => handleRemove(ur.role.id, ur.role.name)}
                      className="flex h-4 w-4 items-center justify-center rounded-full text-prominent-purple-500 transition hover:bg-prominent-purple-200 hover:text-prominent-purple-800 disabled:opacity-50"
                      title={`Remove ${ur.role.name}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Role selection */}
          <div>
            <label htmlFor="role-select" className="mb-2 block text-sm font-medium text-zinc-700">
              Select Role to Assign
            </label>
            <select
              id="role-select"
              value={selectedRoleId}
              onChange={(e) => setSelectedRoleId(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
            >
              <option value="">-- Choose a role --</option>
              {availableRoles.map((role) => (
                <option key={role.id} value={role.id} disabled={currentRoleIds.has(role.id)}>
                  {role.name}
                  {currentRoleIds.has(role.id) ? ' (already assigned)' : ''}
                  {role.description ? ` - ${role.description}` : ''}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-zinc-500">Note: Users can have multiple roles</p>
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
            disabled={isAssigning || !selectedRoleId}
            className="rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-prominent-purple-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isAssigning ? 'Assigning...' : 'Assign Role'}
          </button>
        </div>
      </div>
    </div>
  )
}
