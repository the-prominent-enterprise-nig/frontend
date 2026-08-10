import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import FxRevaluationView from './_components/FxRevaluationView'

export const metadata = { title: 'FX Revaluation' }
export default async function Page() {
  const session = await getSessionOrNull()
  requirePermission(session, ACCOUNTING_PERMISSIONS.FX_READ)
  return (
    <div className="min-h-screen bg-gray-50">
      <FxRevaluationView />
    </div>
  )
}
