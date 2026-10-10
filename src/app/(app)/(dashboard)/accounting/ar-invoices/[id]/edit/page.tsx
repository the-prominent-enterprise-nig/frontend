import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import ARInvoiceForm from '../../_components/ARInvoiceForm'

export const metadata = { title: 'Edit AR Invoice' }
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionOrNull()
  requirePermission(session, ACCOUNTING_PERMISSIONS.AR_INVOICES_UPDATE)
  const { id } = await params
  return <ARInvoiceForm id={id} />
}
