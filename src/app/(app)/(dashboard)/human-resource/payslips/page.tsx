import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { HR_PERMISSIONS } from '@/src/libs/guards/hr-permissions'
import { redirect } from 'next/navigation'
import AdminPayslipsView from './_components/AdminPayslipsView'

export default async function PayslipsPage() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')

  // Users without payslip read access go to their personal self-service view
  if (!can(session, HR_PERMISSIONS.PAYSLIPS_READ)) {
    redirect('/workspace/payslips')
  }

  return <AdminPayslipsView />
}
