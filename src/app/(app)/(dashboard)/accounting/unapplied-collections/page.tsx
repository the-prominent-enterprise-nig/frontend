import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import UnappliedCollectionsList from './_components/UnappliedCollectionsList'

export const metadata = { title: 'Unapplied Collections' }
export default async function Page() {
  const session = await getSessionOrNull()
  requirePermission(session, ACCOUNTING_PERMISSIONS.UNAPPLIED_COLLECTIONS_READ)
  return (
    <div className="min-h-screen bg-gray-50">
      <UnappliedCollectionsList />
    </div>
  )
}
