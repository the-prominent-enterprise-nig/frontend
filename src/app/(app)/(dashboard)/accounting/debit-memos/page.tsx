import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import DebitMemosList from './_components/DebitMemosList'

export const metadata = { title: 'Debit Memos' }
export default async function Page() {
  const session = await getSessionOrNull()
  requirePermission(session, ACCOUNTING_PERMISSIONS.DEBIT_MEMOS_READ)
  return (
    <div className="min-h-screen bg-gray-50">
      <DebitMemosList />
    </div>
  )
}
