import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { CRM_PERMISSIONS } from '@/src/libs/guards/crm-permissions'
import InstallmentAccountDetail from './_components/InstallmentAccountDetail'

export const metadata = { title: 'Installment Account | CRM' }

export default async function InstallmentAccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!can(session, CRM_PERMISSIONS.INSTALLMENT_ACCOUNTS_READ)) redirect('/403')

  const { id } = await params
  return (
    <InstallmentAccountDetail
      id={id}
      canEdit={can(session, CRM_PERMISSIONS.INSTALLMENT_ACCOUNTS_UPDATE)}
      canEarlyPayoff={can(session, CRM_PERMISSIONS.INSTALLMENT_ACCOUNTS_EARLY_PAYOFF)}
      canRecordPayment={can(session, CRM_PERMISSIONS.INSTALLMENT_ACCOUNTS_RECORD_PAYMENT)}
      canApproveGraduation={can(session, CRM_PERMISSIONS.INSTALLMENT_ACCOUNTS_APPROVE_GRADUATION)}
    />
  )
}
