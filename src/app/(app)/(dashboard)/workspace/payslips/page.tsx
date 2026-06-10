import { getSessionOrNull } from '@/src/libs/auth/actions'
import ComingSoon from '@/src/components/common/ComingSoon'
import { redirect } from 'next/navigation'
import MyPayslipsView from '../../human-resource/payslips/my/_components/MyPayslipsView'

export const metadata = {
  title: 'My Payslips | Prominent Enterprise',
}

export default async function WorkspacePayslipsPage() {
  const session = await getSessionOrNull()

  if (!session) redirect('/login')

  if (!session.employeeId) {
    return (
      <ComingSoon
        title="My Payslips"
        description="Your payslips will appear here once your user account is linked to an employee record."
      />
    )
  }

  const employeeName = session.employee
    ? `${session.employee.firstName} ${session.employee.lastName}`
    : session.name

  return <MyPayslipsView employeeName={employeeName} />
}
