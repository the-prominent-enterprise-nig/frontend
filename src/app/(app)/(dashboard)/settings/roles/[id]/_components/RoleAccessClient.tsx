'use client'

import { ArrowLeft, AlertTriangle, RotateCcw, ShieldCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { type Permission, type Role } from '@/src/schema/settings/list'
import { assignPermissions, reactivateRole } from '@/src/app/(app)/(dashboard)/settings/_actions'
import ModuleAccessList from '@/src/components/settings/ModuleAccessList'
import AdvancedPermissionsSection from '@/src/components/settings/AdvancedPermissionsSection'
import UnsavedChangesModal from '@/src/components/settings/UnsavedChangesModal'
import { showToast } from '@/src/components/ui/toast'
import { useUnsavedChangesGuard } from '@/src/hooks/useUnsavedChangesGuard'
import { ACCESS_MODULES, getModulePermissions } from '@/src/components/settings/access-levels'

// Business Owner's permissions and active status can't be changed by anyone
// via the API — see the backend's roles.service.ts assertNotFounderRole.
// A modal only ever opened this for other roles (RolesSection never rendered
// the button for it); a page has a real URL, reachable by typing or a
// bookmark regardless, so the block has to live here too, not just in what
// links to it.
const FOUNDER_ROLE_NAME = 'Business Owner'

type RoleAccessClientProps = {
  role: Role
  availablePermissions: Permission[]
}

export default function RoleAccessClient({ role, availablePermissions }: RoleAccessClientProps) {
  const router = useRouter()
  const isFounderRole = role.name === FOUNDER_ROLE_NAME

  const [selected, setSelected] = useState<Set<string>>(
    new Set(role.permissions.map((rolePermission) => rolePermission.permission.id))
  )
  const [isSaving, setIsSaving] = useState(false)
  const [isReactivating, setIsReactivating] = useState(false)

  // Frozen once, from what the role held on load — same reasoning as
  // moduleOrder below: comparing against a moving target would never detect
  // "still equal to what's saved."
  const initialSelectedIds = useMemo(
    () => new Set(role.permissions.map((rolePermission) => rolePermission.permission.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const hasUnsavedChanges = useMemo(() => {
    if (selected.size !== initialSelectedIds.size) return true
    for (const id of selected) {
      if (!initialSelectedIds.has(id)) return true
    }
    return false
  }, [selected, initialSelectedIds])

  const { showLeaveConfirm, setShowLeaveConfirm, handleLeave, confirmLeave } =
    useUnsavedChangesGuard(hasUnsavedChanges, '/settings/roles')

  // Row order is decided once, from what the role held on load, then held
  // still — see ModuleAccessList's own doc comment for why.
  const moduleOrder = useMemo(() => {
    const initialIds = new Set(
      role.permissions.map((rolePermission) => rolePermission.permission.id)
    )
    return ACCESS_MODULES.map((moduleConfig) => ({
      key: moduleConfig.key,
      label: moduleConfig.label,
      granted: getModulePermissions(availablePermissions, moduleConfig).some((permission) =>
        initialIds.has(permission.id)
      ),
    }))
      .sort((a, b) => {
        if (a.granted !== b.granted) return a.granted ? -1 : 1
        return a.label.localeCompare(b.label)
      })
      .map((entry) => entry.key)
    // role.permissions is only read once, on mount — not a dependency, same
    // as the freeze this is implementing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availablePermissions])

  async function handleSave() {
    setIsSaving(true)

    try {
      const result = await assignPermissions({
        roleId: role.id,
        permissionIds: Array.from(selected),
      })

      if (!result.success) {
        showToast({
          title: 'Failed to update access',
          description: result.message || result.error,
          status: 'error',
        })
        return
      }

      showToast({
        title: 'Role access updated',
        description: `${role.name} access has been updated.`,
        status: 'success',
      })

      router.push('/settings/roles')
      router.refresh()
    } catch (error) {
      showToast({
        title: 'Failed to update access',
        description: error instanceof Error ? error.message : 'Unknown error',
        status: 'error',
      })
    } finally {
      setIsSaving(false)
    }
  }

  async function handleReactivate() {
    setIsReactivating(true)

    try {
      const result = await reactivateRole(role.id)

      if (!result.success) {
        showToast({
          title: 'Failed to reactivate role',
          description: result.message || result.error,
          status: 'error',
        })
        return
      }

      showToast({
        title: 'Role reactivated',
        description: `${role.name} has been reactivated.`,
        status: 'success',
      })

      router.refresh()
    } catch (error) {
      showToast({
        title: 'Failed to reactivate role',
        description: error instanceof Error ? error.message : 'Unknown error',
        status: 'error',
      })
    } finally {
      setIsReactivating(false)
    }
  }

  return (
    // flex-col + flex-1 on the content: sticky only pins once content overflows,
    // so on a short page the save bar would otherwise float mid-screen.
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
          <div className="flex items-start justify-between gap-4 px-6 py-5">
            <div className="flex min-w-0 items-center gap-3.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-prominent-purple-50 ring-1 ring-inset ring-prominent-purple-100">
                <ShieldCheck className="h-5 w-5 text-prominent-purple-700" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                  Manage access
                </p>
                <h1 className="truncate text-xl font-semibold tracking-tight text-zinc-900">
                  {role.name}
                </h1>
                {role.description && (
                  <p className="mt-0.5 text-sm text-zinc-500">{role.description}</p>
                )}
              </div>
            </div>
            <span
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
                role.isActive
                  ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                  : 'bg-zinc-100 text-zinc-600 ring-zinc-200'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${role.isActive ? 'bg-emerald-500' : 'bg-zinc-400'}`}
              />
              {role.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>

          {isFounderRole && (
            <div className="mx-6 mb-5 flex items-start gap-2 rounded-xl border border-prominent-purple-100 bg-prominent-purple-50/60 px-4 py-3 text-sm text-prominent-purple-900">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-prominent-purple-500" />
              <span>
                Business Owner&apos;s permissions are fixed and can&apos;t be edited — shown here
                read-only.
              </span>
            </div>
          )}

          {!role.isActive && (
            <div className="mx-6 mb-5 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <span>
                  This role is inactive — it can&apos;t be assigned to anyone until it&apos;s
                  reactivated. Its permissions are unchanged and ready to go.
                </span>
              </div>
              <button
                type="button"
                onClick={handleReactivate}
                disabled={isReactivating}
                className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 sm:self-auto"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {isReactivating ? 'Reactivating...' : 'Reactivate'}
              </button>
            </div>
          )}
        </div>

        <fieldset disabled={isFounderRole} className="space-y-6 disabled:opacity-60">
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
              moduleOrder={moduleOrder}
            />
          </section>

          <AdvancedPermissionsSection
            availablePermissions={availablePermissions}
            selected={selected}
            onChange={setSelected}
          />
        </fieldset>
      </div>

      {!isFounderRole && (
        // sticky, not fixed: this page renders inside the app shell's own
        // scroll container (AppLayout's `overflow-y-auto` div, next to the
        // sidebar as a flex sibling, not the browser viewport) — `fixed`
        // positions relative to the viewport regardless, so the bar spanned
        // edge to edge including underneath the sidebar. `sticky` respects
        // the actual container, so it only ever spans the content area.
        //
        // Solid background, not translucent — resource rows for a module at
        // Mixed Access sit on a tinted orange card (bg-orange-50/60), and a
        // blurred/transparent bar reads as murky wherever one of those scrolls
        // underneath it. The shadow points up (negative y), the one direction
        // Tailwind's own shadow utilities don't cover, so the bar reads as
        // floating above the scrolled content instead of just a flat divider.
        //
        // bottom-[70px] below md: SideBar.tsx renders its own `fixed bottom-0
        // z-50` mobile tab bar (measured 70px tall) on every (app) route, so
        // sticky bottom-0 here parked Save Access directly underneath it —
        // same z-50, later in paint order, fully covering the button. Offset
        // by the tab bar's height so the two stack instead of overlap; md:
        // and up hide that tab bar entirely, so bottom-0 there is correct.
        <div className="sticky bottom-17.5 z-50 border-t border-zinc-200 bg-white px-6 shadow-[0_-6px_16px_-4px_rgb(0_0_0/0.08)] md:bottom-0">
          <div className="mx-auto flex max-w-5xl items-center justify-between py-4">
            <div className="flex items-center gap-3 text-sm text-zinc-500">
              <p>
                <span className="font-semibold text-zinc-700">{selected.size}</span>{' '}
                {selected.size === 1 ? 'capability' : 'capabilities'} selected
              </p>
              {hasUnsavedChanges && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  Unsaved changes
                </span>
              )}
            </div>
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
                {isSaving ? 'Saving...' : 'Save Access'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showLeaveConfirm && (
        <UnsavedChangesModal
          message={`You have unsaved changes to ${role.name}'s access. Leave without saving?`}
          onKeepEditing={() => setShowLeaveConfirm(false)}
          onLeave={confirmLeave}
        />
      )}
    </div>
  )
}
