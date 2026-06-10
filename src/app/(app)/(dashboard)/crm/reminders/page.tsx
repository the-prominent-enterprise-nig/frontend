import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { CRM_PERMISSIONS } from '@/src/libs/guards/crm-permissions'
import RemindersList from './_components/RemindersList'

export const metadata = { title: 'Reminders | CRM' }

export default async function RemindersPage() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!can(session, CRM_PERMISSIONS.REMINDERS_READ)) redirect('/403')

  return <RemindersList />
}
