import { getSessionOrNull } from '@/src/libs/auth/actions'
import { isAdmin } from '@/src/libs/guards/permission'
import RolesSection from '@/src/components/settings/RolesSection'
import { getRoles, getPermissions } from '../_actions'
import { redirect } from 'next/navigation'

export default async function RolesPage() {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  if (!isAdmin(session)) {
    redirect('/403')
  }

  // Fetch roles and permissions server-side
  const [rolesResult, permissionsResult] = await Promise.all([getRoles(), getPermissions()])

  // Handle error case for roles
  if (!rolesResult.success || !rolesResult.data) {
    return (
      <div className="min-h-full bg-zinc-50 px-6 py-6">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
            <p className="text-red-600">
              Failed to load roles: {rolesResult.error || 'Unknown error'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Handle error case for permissions (non-blocking - show warning but continue)
  if (!permissionsResult.success || !permissionsResult.data) {
    console.warn('Failed to load permissions:', permissionsResult.error)
  }

  // Normalize response: handle both array and paginated response
  const roles = Array.isArray(rolesResult.data) ? rolesResult.data : rolesResult.data.data
  const permissions =
    permissionsResult.success && permissionsResult.data
      ? Array.isArray(permissionsResult.data)
        ? permissionsResult.data
        : permissionsResult.data.data
      : []

  return (
    <div className="min-h-full bg-zinc-50 px-6 py-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-3xl font-semibold text-zinc-900">Roles & Access</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Review roles, module access, and permissions for users in your enterprise.
          </p>
        </div>
        <RolesSection initialRoles={roles} availablePermissions={permissions} />
      </div>
    </div>
  )
}
