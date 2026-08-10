import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import ARInvoiceDetail from './_components/ARInvoiceDetail'

export const metadata = { title: 'AR Invoice Detail' }
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionOrNull()
  requirePermission(session, ACCOUNTING_PERMISSIONS.AR_INVOICES_READ)
  const { id } = await params
  return (
    <div className="min-h-screen bg-gray-50">
      <ARInvoiceDetail id={id} />
    </div>
  )
}
