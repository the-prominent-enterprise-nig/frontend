import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { CRM_PERMISSIONS } from '@/src/libs/guards/crm-permissions'
import CollectionsCalendar from './_components/CollectionsCalendar'

export const metadata = { title: 'Collections Calendar | CRM' }

export default async function CollectionsCalendarPage() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!can(session, CRM_PERMISSIONS.COLLECTIONS_CALENDAR_READ)) redirect('/403')

  return <CollectionsCalendar />
}
