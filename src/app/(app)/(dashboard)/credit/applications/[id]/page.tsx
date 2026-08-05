import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { CREDIT_PERMISSIONS } from '@/src/libs/guards/credit-permissions'
import { CreditApplicationDetail } from '../_components'

export const metadata = {
  title: 'Credit Application | Prominent Enterprise',
  description: 'Credit application detail, documents, and status',
}

export default async function CreditApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  if (!can(session, CREDIT_PERMISSIONS.APPLICATION_VIEW)) {
    redirect('/403')
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <CreditApplicationDetail id={id} session={session} />
    </div>
  )
}
