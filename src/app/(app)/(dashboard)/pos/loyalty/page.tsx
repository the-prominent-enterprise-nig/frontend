import { getSessionOrNull } from '@/src/libs/auth/actions'
import { canManagePosSettings } from '@/src/libs/guards/permission'
import LoyaltyClient from './_components/LoyaltyClient'

export default async function LoyaltyPage() {
  const session = await getSessionOrNull()
  const canManage = session ? canManagePosSettings(session) : false
  const tenantId = session?.enterpriseOwnerId ?? session?.id ?? null
  return <LoyaltyClient canManage={canManage} tenantId={tenantId} />
}
