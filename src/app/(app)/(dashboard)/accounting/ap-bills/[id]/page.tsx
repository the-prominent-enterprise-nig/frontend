import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import APBillDetail from './_components/APBillDetail'

export const metadata = { title: 'AP Bill Detail' }
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionOrNull()
  requirePermission(session, ACCOUNTING_PERMISSIONS.AP_BILLS_READ)
  const { id } = await params
  return (
    <div className="min-h-screen bg-gray-50">
      <APBillDetail id={id} />
    </div>
  )
}
