import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import InstallmentLedgerView from '@/src/components/crm/InstallmentLedgerView'

export const metadata = {
  title: 'Installment Ledger | Prominent Enterprise',
  description: 'Chronological ledger for one customer installment plan',
}

export default async function InstallmentLedgerPage({
  params,
}: {
  params: Promise<{ id: string; accountId: string }>
}) {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!can(session, ACCOUNTING_PERMISSIONS.CUSTOMER_READ)) redirect('/403')

  const { id, accountId } = await params
  return (
    <div className="min-h-screen bg-zinc-50">
      <InstallmentLedgerView
        accountId={accountId}
        backHref={`/accounting/customers/${id}`}
        backLabel="Back to customer"
      />
    </div>
  )
}
