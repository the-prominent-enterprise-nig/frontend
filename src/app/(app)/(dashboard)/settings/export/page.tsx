import ComingSoon from '@/src/components/common/ComingSoon'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { isAdmin } from '@/src/libs/guards/permission'
import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Reports | Prominent Enterprise',
}

export default async function ReportsExportSettingsPage() {
  const session = await getSessionOrNull()

  if (!session) redirect('/login')
  if (!isAdmin(session)) redirect('/403')

  return (
    <ComingSoon
      title="Reports"
      description="Enterprise-wide reports and full data export tools will be added here for owner-controlled records and audit needs."
    />
  )
}
