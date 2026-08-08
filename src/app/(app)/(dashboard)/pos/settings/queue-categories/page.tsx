import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { POS_PERMISSIONS } from '@/src/libs/guards/pos-permissions'
import QueueCategoriesClient from './_components/QueueCategoriesClient'

export const metadata = { title: 'Queue Categories | Prominent Enterprise' }

export default async function QueueCategoriesPage() {
  const session = await getSessionOrNull()
  requirePermission(session, POS_PERMISSIONS.CONFIG_READ)

  return <QueueCategoriesClient />
}
