import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { POS_PERMISSIONS } from '@/src/libs/guards/pos-permissions'
import { QuotaList } from './_components/QuotaList'

export const metadata = {
  title: 'Sales Targets | Prominent Enterprise',
  description: 'Track branch sales revenue against a target',
}

export default async function SalesQuotasPage() {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  if (!can(session, POS_PERMISSIONS.SALES_QUOTAS_READ)) {
    redirect('/403')
  }

  const canManage = can(session, POS_PERMISSIONS.SALES_QUOTAS_MANAGE)

  return (
    <div className="min-h-screen bg-zinc-50">
      <QuotaList canManage={canManage} />
    </div>
  )
}
