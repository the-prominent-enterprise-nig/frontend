import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import BillForm from '../../_components/BillForm'

export const metadata = { title: 'Edit Bill' }
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSessionOrNull()
  requirePermission(session, ACCOUNTING_PERMISSIONS.AP_BILLS_UPDATE)
  return <BillForm billId={id} />
}
