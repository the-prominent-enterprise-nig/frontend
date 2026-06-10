import { getSessionOrNull } from '@/src/libs/auth/actions'
import ComingSoon from '@/src/components/common/ComingSoon'
import { redirect } from 'next/navigation'
import MyLeaveView from '@/src/components/workspace/MyLeaveView'

export const metadata = {
  title: 'My Leave | Prominent Enterprise',
}

export default async function MyLeavePage() {
  const session = await getSessionOrNull()

  if (!session) redirect('/login')

  if (!session.employeeId) {
    return (
      <ComingSoon
        title="My Leave"
        description="Your leave data will appear here once your account is linked to an employee record."
      />
    )
  }

  const employeeName = session.employee
    ? `${session.employee.firstName} ${session.employee.lastName}`
    : (session.name ?? session.email ?? 'Employee')

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <MyLeaveView employeeId={session.employeeId} employeeName={employeeName} />
    </div>
  )
}
