import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import APPaymentMethodsPanel from './_components/APPaymentMethodsPanel'

export const metadata = { title: 'AP Payment Methods' }
export default async function Page() {
  const session = await getSessionOrNull()
  requirePermission(session, ACCOUNTING_PERMISSIONS.AP_PAYMENT_METHODS_READ)
  return (
    <div className="min-h-screen bg-gray-50">
      <APPaymentMethodsPanel />
    </div>
  )
}
