import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { CRM_PERMISSIONS } from '@/src/libs/guards/crm-permissions'
import CustomerLedgerView from '@/src/components/crm/CustomerLedgerView'

export const metadata = { title: 'Customer Ledger | CRM' }

export default async function CrmCustomerLedgerPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!can(session, CRM_PERMISSIONS.CUSTOMERS_READ)) redirect('/403')

  const { id } = await params
  return (
    <div className="min-h-screen bg-zinc-50">
      <CustomerLedgerView
        customerId={id}
        backHref={`/crm/customers/${id}`}
        backLabel="Back to customer"
        canEdit={can(session, CRM_PERMISSIONS.CUSTOMERS_UPDATE)}
      />
    </div>
  )
}
