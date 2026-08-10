import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import ARInvoicesList from './_components/ARInvoicesList'

export const metadata = { title: 'AR Invoices' }
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>
}) {
  const session = await getSessionOrNull()
  requirePermission(session, ACCOUNTING_PERMISSIONS.AR_INVOICES_READ)
  const { customerId } = await searchParams
  return (
    <div className="min-h-screen bg-gray-50">
      <ARInvoicesList initialCustomerId={customerId} />
    </div>
  )
}
