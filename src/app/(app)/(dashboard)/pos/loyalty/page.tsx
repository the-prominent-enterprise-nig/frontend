import { getSessionOrNull } from '@/src/libs/auth/actions'
import { canManagePosSettings } from '@/src/libs/guards/permission'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { POS_PERMISSIONS } from '@/src/libs/guards/pos-permissions'
import LoyaltyClient from './_components/LoyaltyClient'

export default async function LoyaltyPage() {
  const sessionOrNull = await getSessionOrNull()
  const session = requirePermission(sessionOrNull, POS_PERMISSIONS.LOYALTY_READ)
  const canManage = canManagePosSettings(session)
  const tenantId = session.enterpriseOwnerId ?? session.id ?? null
  return <LoyaltyClient canManage={canManage} tenantId={tenantId} />
}
