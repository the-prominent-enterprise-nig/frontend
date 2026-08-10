import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { POS_PERMISSIONS } from '@/src/libs/guards/pos-permissions'
import PosConfigClient from './_components/PosConfigClient'

export const metadata = { title: 'POS General Configuration | Prominent Enterprise' }

export default async function PosConfigPage() {
  const session = await getSessionOrNull()
  requirePermission(session, POS_PERMISSIONS.CONFIG_READ)

  return <PosConfigClient />
}
