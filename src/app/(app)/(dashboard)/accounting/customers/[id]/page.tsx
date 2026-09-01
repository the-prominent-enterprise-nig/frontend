import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import CustomerDetail from './_components/CustomerDetail'

export const metadata = {
  title: 'Customer | Prominent Enterprise',
  description: 'View a customer record',
}

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!can(session, ACCOUNTING_PERMISSIONS.CUSTOMER_READ)) redirect('/403')

  const { id } = await params
  return (
    <div className="min-h-screen bg-zinc-50">
      <CustomerDetail id={id} />
    </div>
  )
}
