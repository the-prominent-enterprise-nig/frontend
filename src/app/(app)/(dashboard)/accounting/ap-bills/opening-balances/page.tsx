import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import OpeningBalanceImportView from '../../_shared/opening-balances/OpeningBalanceImportView'

export const metadata = { title: 'AP Beginning Balances' }
export default async function Page() {
  requirePermission(await getSessionOrNull(), ACCOUNTING_PERMISSIONS.AP_BILLS_CREATE)
  return (
    <div className="min-h-screen bg-gray-50">
      <OpeningBalanceImportView kind="ap-bills" />
    </div>
  )
}
