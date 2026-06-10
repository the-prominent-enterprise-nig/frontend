import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import CustomersList from './_components/CustomersList'

export const metadata = {
  title: 'Customers | Prominent Enterprise',
  description: 'Manage customer records',
}

export default async function CustomersPage() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!can(session, ACCOUNTING_PERMISSIONS.CUSTOMER_READ)) redirect('/403')

  return (
    <div className="min-h-screen bg-zinc-50">
      <CustomersList session={session} />
    </div>
  )
}
