import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { CRM_PERMISSIONS } from '@/src/libs/guards/crm-permissions'
import InstallmentAccountsList from './_components/InstallmentAccountsList'

export const metadata = { title: 'Installment Accounts | CRM' }

export default async function InstallmentAccountsPage() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!can(session, CRM_PERMISSIONS.INSTALLMENT_ACCOUNTS_READ)) redirect('/403')

  return (
    <InstallmentAccountsList
      canCreate={can(session, CRM_PERMISSIONS.INSTALLMENT_ACCOUNTS_CREATE)}
    />
  )
}
