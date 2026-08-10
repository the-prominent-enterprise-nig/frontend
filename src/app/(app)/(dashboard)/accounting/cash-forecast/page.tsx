import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import CashForecastView from './_components/CashForecastView'

export const metadata = { title: 'Cash Forecast' }
export default async function Page() {
  const session = await getSessionOrNull()
  requirePermission(session, ACCOUNTING_PERMISSIONS.CASH_FORECAST_READ)
  return (
    <div className="min-h-screen bg-gray-50">
      <CashForecastView />
    </div>
  )
}
