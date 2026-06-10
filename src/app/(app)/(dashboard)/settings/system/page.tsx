import ComingSoon from '@/src/components/common/ComingSoon'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { isAdmin } from '@/src/libs/guards/permission'
import { redirect } from 'next/navigation'

export const metadata = {
  title: 'System Settings | Prominent Enterprise',
}

export default async function SystemSettingsPage() {
  const session = await getSessionOrNull()

  if (!session) redirect('/login')
  if (!isAdmin(session)) redirect('/403')

  return (
    <ComingSoon
      title="Enterprise Owner System Settings"
      description="Business profile, branding, currency, timezone, date format, module access, and role access settings will be managed here."
    />
  )
}
