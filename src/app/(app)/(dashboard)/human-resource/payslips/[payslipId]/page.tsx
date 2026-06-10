import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { HR_PERMISSIONS } from '@/src/libs/guards/hr-permissions'
import { redirect } from 'next/navigation'
import PayslipDetailView from '../_components/PayslipDetailView'

export default async function PayslipDetailPage({
  params,
}: {
  params: Promise<{ payslipId: string }>
}) {
  const { payslipId } = await params
  const session = await getSessionOrNull()
  if (!session) redirect('/login')

  const canEdit = can(session, HR_PERMISSIONS.PAYSLIPS_UPDATE)

  return <PayslipDetailView payslipId={payslipId} canEdit={canEdit} />
}
