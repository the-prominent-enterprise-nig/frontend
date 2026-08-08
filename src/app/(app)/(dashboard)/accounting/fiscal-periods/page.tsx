import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import FiscalPeriodsList from './_components/FiscalPeriodsList'

export const metadata = { title: 'Fiscal Periods' }
export default async function Page() {
  const session = await getSessionOrNull()
  requirePermission(session, ACCOUNTING_PERMISSIONS.FISCAL_READ)
  return (
    <div className="min-h-screen bg-gray-50">
      <FiscalPeriodsList />
    </div>
  )
}
