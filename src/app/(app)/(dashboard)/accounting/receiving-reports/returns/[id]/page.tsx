import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import { CustomerReturnReceiptDetail } from '../../../../inventory/returns/_components/CustomerReturnReceiptDetail'

export const metadata = { title: 'Receiving Report' }

/** Ticket #27 — a Return row in Accounting's Receiving Reports opens its RRC
 * receipt here, with the back link returning to Accounting's list. */
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<React.JSX.Element> {
  const session = await getSessionOrNull()
  requirePermission(session, ACCOUNTING_PERMISSIONS.FINANCIAL_REPORT_READ)
  const { id } = await params
  return (
    <div className="min-h-screen bg-gray-50">
      <CustomerReturnReceiptDetail
        id={id}
        backHref="/accounting/receiving-reports"
        backLabel="Back to Receiving Reports"
      />
    </div>
  )
}
