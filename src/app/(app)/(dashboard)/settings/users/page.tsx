import UsersSection from '@/src/components/settings/UsersSection'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can, isAdmin } from '@/src/libs/guards/permission'
import { getUsers } from '../_actions/get-users'
import { getRoles } from '../_actions/get-roles'
import { redirect } from 'next/navigation'

export default async function UsersPage() {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  const canViewUsers = isAdmin(session) || can(session, 'admin:users:read')
  if (!canViewUsers) {
    redirect('/403')
  }

  // Fetch users and roles server-side
  const [usersResult, rolesResult] = await Promise.all([getUsers(), getRoles()])

  // Handle error case
  if (!usersResult.success || !usersResult.data) {
    return (
      <div className="min-h-full bg-zinc-50 px-6 py-6">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
            <p className="text-red-600">
              Failed to load users: {usersResult.error || 'Unknown error'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Normalize response: handle both array and paginated response
  const users = Array.isArray(usersResult.data) ? usersResult.data : usersResult.data.data
  const roles =
    rolesResult.success && rolesResult.data
      ? Array.isArray(rolesResult.data)
        ? rolesResult.data
        : rolesResult.data.data
      : []

  return (
    <div className="min-h-full bg-zinc-50 px-6 py-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-3xl font-semibold text-zinc-900">Users</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Create and manage user accounts and assign roles.
          </p>
        </div>
        <UsersSection
          initialUsers={users}
          availableRoles={roles}
          currentUserId={session.id}
          canAddUser={isAdmin(session) || can(session, 'admin:users:create')}
        />
      </div>
    </div>
  )
}
