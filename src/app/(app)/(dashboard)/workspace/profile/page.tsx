import { getSessionOrNull } from '@/src/libs/auth/actions'
import ComingSoon from '@/src/components/common/ComingSoon'
import { redirect } from 'next/navigation'
import { EmployeeDetailShell } from '../../human-resource/employees/_components/details'
import OwnerProfileView from '@/src/components/workspace/OwnerProfileView'

export const metadata = {
  title: 'My Profile | Prominent Enterprise',
}

export default async function WorkspaceProfilePage() {
  const session = await getSessionOrNull()

  if (!session) redirect('/login')

  if (session.primaryRole === 'enterprise-owner' || session.roles.includes('enterprise-owner')) {
    return <OwnerProfileView session={session} />
  }

  if (!session.employeeId) {
    return (
      <ComingSoon
        title="Profile unavailable"
        description="Your profile data is not ready yet. Contact your administrator."
      />
    )
  }

  return (
    <EmployeeDetailShell
      id={session.employeeId}
      showBackButton={false}
      showRefreshButton={false}
      visibleSections={['personal', 'bank-accounts', 'government-ids', 'emergency-contacts']}
    />
  )
}
