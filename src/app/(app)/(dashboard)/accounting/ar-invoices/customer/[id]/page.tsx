import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import ARInvoicesList from '../../_components/ARInvoicesList'

export const metadata = { title: "Customer's AR Invoices" }

export default async function CustomerARInvoicesPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!can(session, ACCOUNTING_PERMISSIONS.AR_INVOICES_READ)) redirect('/403')

  const { id } = await params
  return (
    <div className="min-h-screen bg-gray-50">
      <ARInvoicesList initialCustomerId={id} dedicatedCustomer />
    </div>
  )
}
