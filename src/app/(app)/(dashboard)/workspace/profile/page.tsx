import { getSessionOrNull } from '@/src/libs/auth/actions'
import ComingSoon from '@/src/components/common/ComingSoon'
import { redirect } from 'next/navigation'
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

  return (
    <ComingSoon
      title="Profile"
      description="Your profile view is being set up. Contact your administrator for account details."
    />
  )
}
