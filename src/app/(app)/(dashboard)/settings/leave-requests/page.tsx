import { getSessionOrNull } from '@/src/libs/auth/actions'
import { redirect } from 'next/navigation'
import LeaveRequestList from '@/src/components/human-resource/LeaveRequestList'

export const metadata = {
  title: 'Leave Requests | Prominent Enterprise',
}

export default async function OwnerLeaveRequestsPage() {
  const session = await getSessionOrNull()

  if (!session) redirect('/login')

  const isOwner =
    session.primaryRole === 'enterprise-owner' || (session.roles ?? []).includes('enterprise-owner')

  if (!isOwner) redirect('/403')

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="border-b border-zinc-200 bg-white px-6 py-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Leave Requests</h1>
        <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
          Review and approve leave requests across your enterprise
        </p>
      </div>
      <LeaveRequestList />
    </div>
  )
}
