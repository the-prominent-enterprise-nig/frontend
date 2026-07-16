import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { canManagePosSettings } from '@/src/libs/guards/permission'
import PosConfigClient from './_components/PosConfigClient'

export const metadata = { title: 'POS General Configuration | Prominent Enterprise' }

export default async function PosConfigPage() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!canManagePosSettings(session)) redirect('/403')

  return <PosConfigClient />
}
