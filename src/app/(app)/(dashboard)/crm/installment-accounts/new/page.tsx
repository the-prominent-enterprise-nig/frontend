import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { CRM_PERMISSIONS } from '@/src/libs/guards/crm-permissions'
import NewInstallmentAccountForm from './_components/NewInstallmentAccountForm'

export const metadata = { title: 'New Installment Account | CRM' }

export default async function NewInstallmentAccountPage() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!can(session, CRM_PERMISSIONS.INSTALLMENT_ACCOUNTS_CREATE)) redirect('/403')

  return <NewInstallmentAccountForm />
}
