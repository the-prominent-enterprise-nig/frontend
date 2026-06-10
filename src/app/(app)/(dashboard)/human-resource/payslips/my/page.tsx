import { getSessionOrNull } from '@/src/libs/auth/actions'
import { redirect } from 'next/navigation'
import MyPayslipsView from './_components/MyPayslipsView'
import ComingSoon from '@/src/components/common/ComingSoon'

export const metadata = {
  title: 'My Payslips | Prominent Enterprise',
}

export default async function MyPayslipsPage() {
  const session = await getSessionOrNull()

  if (!session) redirect('/login')

  const employeeId = session.employeeId
  if (!employeeId) {
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
