import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import TaxPanel from './_components/TaxPanel'

export const metadata = { title: 'Tax' }
export default async function Page() {
  const session = await getSessionOrNull()
  const user = requirePermission(session, ACCOUNTING_PERMISSIONS.TAX_READ)
  return (
    <div className="min-h-screen bg-gray-50">
      <TaxPanel session={user} />
    </div>
  )
}
