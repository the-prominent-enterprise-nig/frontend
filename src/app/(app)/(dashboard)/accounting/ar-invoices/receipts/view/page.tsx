import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import CollectionReceiptDetail from './_components/CollectionReceiptDetail'

export const metadata = { title: 'Collection Receipt' }
export default async function Page() {
  const session = await getSessionOrNull()
  requirePermission(session, ACCOUNTING_PERMISSIONS.AR_INVOICES_READ)
  return (
    <div className="min-h-screen bg-gray-50">
      <CollectionReceiptDetail />
    </div>
  )
}
