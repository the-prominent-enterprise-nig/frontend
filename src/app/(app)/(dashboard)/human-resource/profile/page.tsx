import { getSessionOrNull } from '@/src/libs/auth/actions'
import { canAny } from '@/src/libs/guards/permission'
import { HR_PERMISSIONS } from '@/src/libs/guards/hr-permissions'
import { redirect } from 'next/navigation'
import { EmployeeDetailShell } from '../employees/_components/details'
import ComingSoon from '@/src/components/common/ComingSoon'

export const metadata = {
  title: 'My Profile | Prominent Enterprise',
  description: 'View your employee profile and information',
}

export default async function EmployeeProfilePage() {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  const employeeId = session.employeeId

  if (!employeeId) {
    return (
      <ComingSoon
        title="My Profile"
        description="Your employee profile will appear here once your user account is linked to an employee record."
      />
    )
  }

  if (!canAny(session, [HR_PERMISSIONS.EMPLOYEES_SELF_READ, HR_PERMISSIONS.EMPLOYEES_READ])) {
    return (
      <ComingSoon
        title="My Profile"
        description="Profile self-service is not enabled for this account yet."
      />
    )
  }

  return (
    <EmployeeDetailShell
      id={employeeId}
      showBackButton={false}
      showRefreshButton={false}
      visibleSections={['personal', 'bank-accounts', 'government-ids', 'emergency-contacts']}
    />
  )
}
