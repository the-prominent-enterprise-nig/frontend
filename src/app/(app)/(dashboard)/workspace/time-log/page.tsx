import { getSessionOrNull } from '@/src/libs/auth/actions'
import { redirect } from 'next/navigation'
import ComingSoon from '@/src/components/common/ComingSoon'
import MyTimeLogView from '@/src/components/workspace/MyTimeLogView'

export const metadata = {
  title: 'My Time Log | Prominent Enterprise',
}

export default async function WorkspaceTimeLogPage() {
  const session = await getSessionOrNull()

  if (!session) redirect('/login')

  if (session.primaryRole === 'enterprise-owner' || session.roles.includes('enterprise-owner')) {
    return (
      <ComingSoon
        title="My Time Log"
        description="Time Log is not available for Enterprise Owner accounts."
      />
    )
  }

  if (!session.employeeId) {
    return (
      <ComingSoon
        title="My Time Log"
        description="Your time log will appear here once your account is linked to an employee record."
      />
    )
  }

  const employeeName = session.employee
    ? `${session.employee.firstName} ${session.employee.lastName}`
    : (session.name ?? session.email ?? 'Employee')

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <MyTimeLogView employeeName={employeeName} />
    </div>
  )
}
