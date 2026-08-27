import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { CRM_PERMISSIONS } from '@/src/libs/guards/crm-permissions'
import InstallmentLedgerView from '@/src/components/crm/InstallmentLedgerView'

export const metadata = { title: 'Installment Ledger | CRM' }

export default async function CrmInstallmentLedgerPage({
  params,
}: {
  params: Promise<{ id: string; accountId: string }>
}) {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!can(session, CRM_PERMISSIONS.INSTALLMENT_ACCOUNTS_READ)) redirect('/403')

  const { id, accountId } = await params
  return (
    <div className="min-h-screen bg-zinc-50">
      <InstallmentLedgerView
        accountId={accountId}
        backHref={`/crm/customers/${id}`}
        backLabel="Back to customer"
      />
    </div>
  )
}
