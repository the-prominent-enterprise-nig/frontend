import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { RevaluationPageView } from './_components'

export const metadata = {
  title: 'Inventory Revaluation | Prominent Enterprise',
  description: 'Create and review inventory revaluation entries to adjust carrying values',
}

export default async function RevaluationPage() {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  if (!can(session, INVENTORY_PERMISSIONS.REVALUATION_READ)) {
    redirect('/403')
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <RevaluationPageView session={session} />
    </div>
  )
}
