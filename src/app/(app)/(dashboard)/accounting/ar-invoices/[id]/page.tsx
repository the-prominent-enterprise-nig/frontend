import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import { can } from '@/src/libs/guards/permission'
import ARInvoiceDetail from './_components/ARInvoiceDetail'

export const metadata = { title: 'AR Invoice Detail' }
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const session = requirePermission(
    await getSessionOrNull(),
    ACCOUNTING_PERMISSIONS.AR_INVOICES_READ
  )
  const { id } = await params
  return (
    <div className="min-h-screen bg-gray-50">
      <ARInvoiceDetail
        id={id}
        canReleaseRetention={can(session, ACCOUNTING_PERMISSIONS.AR_INVOICES_PAY)}
        canAdjustRetention={can(session, ACCOUNTING_PERMISSIONS.RETENTION_ADJUST)}
      />
    </div>
  )
}
