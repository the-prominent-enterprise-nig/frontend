import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { PROCUREMENT_PERMISSIONS } from '@/src/libs/guards/procurement-permissions'
import { QuotaList } from './_components/QuotaList'

export const metadata = {
  title: 'Spending Quotas | Prominent Enterprise',
  description: 'Manage procurement spending quotas for purchase orders',
}

export default async function ProcurementQuotasPage() {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  if (!can(session, PROCUREMENT_PERMISSIONS.QUOTA_READ)) {
    redirect('/403')
  }

  const canManage = can(session, PROCUREMENT_PERMISSIONS.QUOTA_MANAGE)

  return (
    <div className="min-h-screen bg-zinc-50">
      <QuotaList canManage={canManage} />
    </div>
  )
}
