import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { CREDIT_PERMISSIONS } from '@/src/libs/guards/credit-permissions'
import { CreditApplicationList } from './_components'

export const metadata = {
  title: 'Credit Applications | Prominent Enterprise',
  description: 'Formal in-house financing applications, from intake through approval',
}

export default async function CreditApplicationsPage() {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  if (!can(session, CREDIT_PERMISSIONS.APPLICATION_VIEW)) {
    redirect('/403')
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <CreditApplicationList session={session} />
    </div>
  )
}
