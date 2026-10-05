import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import XDealMemoForm from './_components/XDealMemoForm'

export const metadata = { title: 'X-Deal Offset' }
export default async function Page() {
  const session = await getSessionOrNull()
  requirePermission(session, ACCOUNTING_PERMISSIONS.X_DEAL_MEMOS_ISSUE)
  return (
    <div className="min-h-screen bg-gray-50">
      <XDealMemoForm />
    </div>
  )
}
