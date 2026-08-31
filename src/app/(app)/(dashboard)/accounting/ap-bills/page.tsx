import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import APBillsList from './_components/APBillsList'

export const metadata = { title: 'AP Invoices' }
export default async function Page() {
  const session = await getSessionOrNull()
  requirePermission(session, ACCOUNTING_PERMISSIONS.AP_BILLS_READ)
  return (
    <div className="min-h-screen bg-gray-50">
      <APBillsList />
    </div>
  )
}
