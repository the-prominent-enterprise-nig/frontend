'use client'

import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { type Permission } from '@/src/schema/settings/list'
import { createRole } from '@/src/app/(app)/(dashboard)/settings/_actions'
import ModuleAccessList from '@/src/components/settings/ModuleAccessList'
import AdvancedPermissionsSection from '@/src/components/settings/AdvancedPermissionsSection'
import UnsavedChangesModal from '@/src/components/settings/UnsavedChangesModal'
import { showToast } from '@/src/components/ui/toast'
import { useUnsavedChangesGuard } from '@/src/hooks/useUnsavedChangesGuard'

type CreateRoleClientProps = {
  availablePermissions: Permission[]
}

export default function CreateRoleClient({ availablePermissions }: CreateRoleClientProps) {
  const router = useRouter()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [nameError, setNameError] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [isSaving, setIsSaving] = useState(false)

  // Nothing saved yet — any input at all (a name typed, a description
  // started, one capability ticked) counts as work that would be lost,
  // unlike Manage Access where "unsaved" means "differs from what's stored."
  const hasUnsavedChanges = useMemo(
    () => name.trim().length > 0 || description.trim().length > 0 || selected.size > 0,
    [name, description, selected]
  )

  const { showLeaveConfirm, setShowLeaveConfirm, handleLeave, confirmLeave } =
    useUnsavedChangesGuard(hasUnsavedChanges, '/settings/roles')

  async function handleSave() {
    if (!name.trim()) {
      setNameError('Designation is required.')
      return
    }
    if (name.length > 100) {
      setNameError('Designation must be 100 characters or fewer.')
      return
    }

    setIsSaving(true)

    try {
      const result = await createRole({
        name: name.trim(),
        description: description.trim() || undefined,
        permissionIds: Array.from(selected),
      })

      if (!result.success) {
        showToast({
          title: 'Failed to create role',
          description: result.message || result.error,
          status: 'error',
        })
        return
      }

      showToast({
        title: 'Role created successfully',
        description: `${name.trim()} has been added`,
        status: 'success',
      })

      router.push('/settings/roles')
      router.refresh()
    } catch (error) {
      showToast({
        title: 'Failed to create role',
        description: error instanceof Error ? error.message : 'Unknown error',
        status: 'error',
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    // See RoleAccessClient — keeps the save bar at the bottom on short pages.
    <div className="flex min-h-full flex-col bg-zinc-50">
      <div className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-6 pb-6 pt-6">
        <button
          type="button"
          onClick={handleLeave}
          className="group inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 transition-colors hover:text-prominent-purple-700"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          Back to Roles
        </button>

        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_1px_2px_0_rgba(0,0,0,0.03),0_2px_8px_-2px_rgba(0,0,0,0.06)]">
          <div className="flex items-center gap-3.5 border-b border-zinc-100 px-6 py-5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-prominent-purple-50 ring-1 ring-inset ring-prominent-purple-100">
              <ShieldCheck className="h-5 w-5 text-prominent-purple-700" />
            </span>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Create Role</h1>
              <p className="mt-0.5 text-sm text-zinc-500">
                Set a name and description, then choose what this role can see and do below.
              </p>
            </div>
          </div>

          <div className="grid gap-x-6 gap-y-5 px-6 py-6 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700">
                Designation <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(event) => {
                  setName(event.target.value)
                  if (nameError) setNameError('')
                }}
                placeholder="e.g. HR Manager"
                maxLength={100}
                className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition ${
                  nameError
                    ? 'border-red-400 focus:border-red-500'
                    : 'border-zinc-200 focus:border-prominent-purple-400 focus:ring-2 focus:ring-prominent-purple-100'
                }`}
              />
              {nameError ? (
                <p className="mt-1 text-xs text-red-500">{nameError}</p>
              ) : (
                <p className="mt-1 text-xs text-zinc-400">Shown wherever this role is assigned.</p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700">
                Job Description
              </label>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Describe what this role is for..."
                rows={2}
                maxLength={255}
                className="w-full resize-none rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none transition focus:border-prominent-purple-400 focus:ring-2 focus:ring-prominent-purple-100"
              />
              <p className="mt-1 text-right text-xs text-zinc-400">{description.length}/255</p>
            </div>
          </div>
        </div>

        <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_1px_2px_0_rgba(0,0,0,0.03),0_2px_8px_-2px_rgba(0,0,0,0.06)]">
          <div className="border-b border-zinc-100 px-6 py-4">
            <h2 className="text-sm font-semibold text-zinc-900">Module access</h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              Choose which modules this role can see and what it can do in each. A module shows in
              the top menu once the role has at least View Only.
            </p>
          </div>
          <ModuleAccessList
            availablePermissions={availablePermissions}
            selected={selected}
            onChange={setSelected}
          />
        </section>

        <AdvancedPermissionsSection
          availablePermissions={availablePermissions}
          selected={selected}
          onChange={setSelected}
        />
      </div>

      {/* See RoleAccessClient's matching bar for why sticky (not fixed),
          solid (not translucent), and offset above the mobile tab bar. */}
      <div className="sticky bottom-17.5 z-50 border-t border-zinc-200 bg-white px-6 shadow-[0_-6px_16px_-4px_rgb(0_0_0/0.08)] md:bottom-0">
        <div className="mx-auto flex max-w-5xl items-center justify-between py-4">
          <p className="text-sm text-zinc-500">
            <span className="font-semibold text-zinc-700">{selected.size}</span>{' '}
            {selected.size === 1 ? 'capability' : 'capabilities'} selected
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleLeave}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-prominent-purple-800 hover:shadow disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? 'Creating...' : 'Create Role'}
            </button>
          </div>
        </div>
      </div>

      {showLeaveConfirm && (
        <UnsavedChangesModal
          message="You have unsaved changes to this new role. Leave without saving?"
          onKeepEditing={() => setShowLeaveConfirm(false)}
          onLeave={confirmLeave}
        />
      )}
    </div>
  )
}
