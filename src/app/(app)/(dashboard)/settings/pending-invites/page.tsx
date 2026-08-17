import PendingInvitesSection from '@/src/components/settings/PendingInvitesSection'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can, isAdmin } from '@/src/libs/guards/permission'
import { getUsers } from '../_actions/get-users'
import { redirect } from 'next/navigation'

export default async function PendingInvitesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
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
  const currentPage = sp.page ? Math.max(1, parseInt(sp.page, 10)) : 1

  const usersResult = await getUsers({ status: 'PENDING', page: currentPage, limit: 20 })

  if (!usersResult.success || !usersResult.data) {
    return (
      <div className="min-h-full bg-zinc-50 px-6 py-6">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
            <p className="text-red-600">
              Failed to load pending invites: {usersResult.error || 'Unknown error'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  const users = Array.isArray(usersResult.data) ? usersResult.data : usersResult.data.data
  const meta = Array.isArray(usersResult.data) ? undefined : usersResult.data.meta

  return (
    <div className="min-h-full bg-zinc-50 px-6 py-6">
      <div className="mx-auto max-w-7xl">
        <PendingInvitesSection
          users={users}
          meta={meta}
          canManage={isAdmin(session) || can(session, 'admin:users:update')}
        />
      </div>
    </div>
  )
}
