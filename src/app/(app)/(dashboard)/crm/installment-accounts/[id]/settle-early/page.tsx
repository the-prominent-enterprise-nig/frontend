import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { CRM_PERMISSIONS } from '@/src/libs/guards/crm-permissions'
import SettleEarlyForm from './_components/SettleEarlyForm'

export const metadata = { title: 'Settle Account Early | CRM' }

export default async function SettleEarlyPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!can(session, CRM_PERMISSIONS.INSTALLMENT_ACCOUNTS_EARLY_PAYOFF)) redirect('/403')

  const { id } = await params
  return <SettleEarlyForm id={id} />
}
