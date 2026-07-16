import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { canManagePosSettings } from '@/src/libs/guards/permission'
import QueueCategoriesClient from './_components/QueueCategoriesClient'

export const metadata = { title: 'Queue Categories | Prominent Enterprise' }

export default async function QueueCategoriesPage() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!canManagePosSettings(session)) redirect('/403')

  return <QueueCategoriesClient />
}
