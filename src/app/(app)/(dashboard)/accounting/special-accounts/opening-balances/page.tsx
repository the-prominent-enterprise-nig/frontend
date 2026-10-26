import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import OpeningBalanceImportView from '../../_shared/opening-balances/OpeningBalanceImportView'

export const metadata = { title: 'Cash Advance Balances' }
export default async function Page() {
  requirePermission(await getSessionOrNull(), ACCOUNTING_PERMISSIONS.EXPENSE_CREATE)
  return (
    <div className="min-h-screen bg-gray-50">
      <OpeningBalanceImportView kind="cash-advances" />
    </div>
  )
}
