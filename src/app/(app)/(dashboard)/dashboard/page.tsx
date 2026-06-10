import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions/get-session'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  return (
    <DashboardClient
      userName={session.firstName ?? session.fullName ?? session.email ?? 'User'}
      roles={session.roles ?? []}
      primaryRole={session.primaryRole}
    />
  )
}
