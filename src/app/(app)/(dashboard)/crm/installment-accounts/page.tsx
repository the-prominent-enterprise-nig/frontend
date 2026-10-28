import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can, canAny } from '@/src/libs/guards/permission'
import { CRM_PERMISSIONS } from '@/src/libs/guards/crm-permissions'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import InstallmentAccountsList from './_components/InstallmentAccountsList'

export const metadata = { title: 'Installment Accounts | CRM' }

export default async function InstallmentAccountsPage() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!can(session, CRM_PERMISSIONS.INSTALLMENT_ACCOUNTS_READ)) redirect('/403')

  return (
    <InstallmentAccountsList
      canCreate={can(session, CRM_PERMISSIONS.INSTALLMENT_ACCOUNTS_CREATE)}
      canLoadAging={canAny(session, [
        CRM_PERMISSIONS.INSTALLMENT_ACCOUNTS_CREATE,
        ACCOUNTING_PERMISSIONS.AR_INVOICES_CREATE,
      ])}
    />
  )
}
