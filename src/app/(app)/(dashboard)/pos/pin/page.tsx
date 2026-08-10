import { getCashierPinStatus } from '../_actions/pos-actions'
import { CashierPinManager } from '@/src/components/pos/CashierPinManager'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { POS_PERMISSIONS } from '@/src/libs/guards/pos-permissions'

export const metadata = { title: 'POS PIN | Prominent Enterprise' }

export default async function CashierPinPage() {
  const session = await getSessionOrNull()
  requirePermission(session, POS_PERMISSIONS.CASHIER_PIN_VERIFY)

  const statusRes = await getCashierPinStatus()
  return (
    <div className="min-h-full bg-zinc-50 px-3 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto max-w-2xl">
        <div className="mb-4 sm:mb-6">
          <h1 className="text-2xl font-bold text-gray-900">POS PIN</h1>
          <p className="mt-1 text-sm text-gray-500">
            Set or update your PIN used to identify yourself and authorize POS approvals.
          </p>
        </div>
        <CashierPinManager initialHasPin={statusRes.data?.hasPin ?? false} />
      </div>
    </div>
  )
}
