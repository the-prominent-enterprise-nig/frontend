import UsersSection from '@/src/components/settings/UsersSection'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can, isAdmin } from '@/src/libs/guards/permission'
import { getUsers } from '../_actions/get-users'
import { getRoles } from '../_actions/get-roles'
import { getBranches } from '../_actions/get-branches'
import { redirect } from 'next/navigation'

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string; branchId?: string; page?: string }>
}) {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  const canViewUsers = isAdmin(session) || can(session, 'admin:users:read')
  if (!canViewUsers) {
    redirect('/403')
  }

  const sp = await searchParams
  const currentSearch = sp.search ?? ''
  const currentStatus = sp.status ?? ''
  const currentBranchId = sp.branchId ?? ''
  const currentPage = sp.page ? Math.max(1, parseInt(sp.page, 10)) : 1

  const [usersResult, rolesResult, branchesResult] = await Promise.all([
    getUsers({
      search: currentSearch || undefined,
      status: currentStatus || undefined,
      branchId: currentBranchId || undefined,
      page: currentPage,
      limit: 20,
    }),
    getRoles(),
    getBranches(),
  ])

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

  const users = Array.isArray(usersResult.data) ? usersResult.data : usersResult.data.data
  const meta = Array.isArray(usersResult.data) ? undefined : usersResult.data.meta
  const roles =
    rolesResult.success && rolesResult.data
      ? Array.isArray(rolesResult.data)
        ? rolesResult.data
        : rolesResult.data.data
      : []
  const branches = branchesResult.success && branchesResult.data ? branchesResult.data : []

  return (
    <div className="min-h-full bg-zinc-50 px-6 py-6">
      <div className="mx-auto max-w-7xl">
        <UsersSection
          users={users}
          meta={meta}
          currentSearch={currentSearch}
          currentStatus={currentStatus}
          currentBranchId={currentBranchId}
          branches={branches}
          availableRoles={roles}
          currentUserId={session.id}
          canAddUser={isAdmin(session) || can(session, 'admin:users:create')}
        />
      </div>
    </div>
  )
}
