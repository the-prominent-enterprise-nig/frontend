import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { canManagePosSettings } from '@/src/libs/guards/permission'
import { getPosOverrideReasons } from '../../_actions/pos-actions'
import { OverrideReasonsManager } from './_components/OverrideReasonsManager'

export const metadata = { title: 'Override Reasons | NIG Central' }

export default async function OverrideReasonsPage() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!canManagePosSettings(session)) redirect('/403')

  const res = await getPosOverrideReasons()
  return (
    <OverrideReasonsManager
      initial={res.success && res.data ? res.data : []}
      initialError={res.success ? '' : (res.error ?? 'Could not load the reasons.')}
    />
  )
}
