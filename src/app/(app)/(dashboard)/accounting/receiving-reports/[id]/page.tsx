import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import ReceivingReportDetail from '../../../inventory/goods-receiving/[id]/_components/ReceivingReportDetail'

export const metadata = { title: 'Receiving Report' }
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionOrNull()
  requirePermission(session, ACCOUNTING_PERMISSIONS.FINANCIAL_REPORT_READ)
  const { id } = await params
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Same document, reached from Accounting — so the back link returns to
          Accounting's own list rather than Inventory's. */}
      <ReceivingReportDetail
        id={id}
        backHref="/accounting/receiving-reports"
        backLabel="Back to Receiving Reports"
      />
    </div>
  )
}
