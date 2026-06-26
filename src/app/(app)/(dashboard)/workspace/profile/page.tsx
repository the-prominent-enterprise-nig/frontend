import { getSessionOrNull } from '@/src/libs/auth/actions'
import { redirect } from 'next/navigation'
import OwnerProfileView from '@/src/components/workspace/OwnerProfileView'
import EmployeeProfileView from '@/src/components/workspace/EmployeeProfileView'
import { getBusinessProfile } from '@/src/libs/actions/enterprise.actions'
import { isAdmin } from '@/src/libs/guards/permission'

export const metadata = {
  title: 'My Profile | Prominent Enterprise',
}

export default async function WorkspaceProfilePage() {
  const session = await getSessionOrNull()

  if (!session) redirect('/login')

  if (session.primaryRole === 'Business Owner' || session.roles.includes('Business Owner')) {
    const profileResult = isAdmin(session) ? await getBusinessProfile() : null
    return (
      <OwnerProfileView
        session={session}
        profile={profileResult?.success ? (profileResult.data ?? null) : null}
      />
    )
  }

  return <EmployeeProfileView session={session} />
}
