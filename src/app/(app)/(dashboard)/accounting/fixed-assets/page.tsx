import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import FixedAssetsList from './_components/FixedAssetsList'

export const metadata = { title: 'Fixed Assets' }
export default async function Page() {
  const session = await getSessionOrNull()
  requirePermission(session, ACCOUNTING_PERMISSIONS.FIXED_ASSET_READ)
  return (
    <div className="min-h-screen bg-gray-50">
      <FixedAssetsList />
    </div>
  )
}
