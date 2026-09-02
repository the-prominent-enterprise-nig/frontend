import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import ReceivingReportsTab from '../../inventory/goods-receiving/_components/ReceivingReportsTab'

export const metadata = { title: 'Receiving Reports' }
export default async function Page() {
  const session = await getSessionOrNull()
  requirePermission(session, ACCOUNTING_PERMISSIONS.FINANCIAL_REPORT_READ)
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <ReceivingReportsTab showAmounts />
    </div>
  )
}
