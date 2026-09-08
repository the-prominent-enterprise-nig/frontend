import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { POS_PERMISSIONS } from '@/src/libs/guards/pos-permissions'
import SalesReportsView from './_components/SalesReportsView'

export const metadata = {
  title: 'Sales Reports | Prominent Enterprise',
  description: 'Sales per branch and per brand, with Excel export',
}

export default async function PosReportsPage() {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  // Branch-Manager tier: these expose unit cost and margin. Business Owner is
  // covered by the enterprise-owner bypass inside can().
  if (!can(session, POS_PERMISSIONS.REPORTS_READ)) {
    redirect('/403')
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <SalesReportsView />
    </div>
  )
}
