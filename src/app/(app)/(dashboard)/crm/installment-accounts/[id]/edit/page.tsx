import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { CRM_PERMISSIONS } from '@/src/libs/guards/crm-permissions'
import EditInstallmentAccountForm from './_components/EditInstallmentAccountForm'

export const metadata = { title: 'Edit Installment Account | CRM' }

export default async function EditInstallmentAccountPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!can(session, CRM_PERMISSIONS.INSTALLMENT_ACCOUNTS_UPDATE)) redirect('/403')

  const { id } = await params
  return <EditInstallmentAccountForm id={id} />
}
