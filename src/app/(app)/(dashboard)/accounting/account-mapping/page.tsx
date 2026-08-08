import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import { POS_PERMISSIONS } from '@/src/libs/guards/pos-permissions'
import AccountMappingPanel from './_components/AccountMappingPanel'

export const metadata = { title: 'Account Mapping' }
export default async function Page() {
  const session = await getSessionOrNull()
  requirePermission(session, [ACCOUNTING_PERMISSIONS.ACCOUNT_READ, POS_PERMISSIONS.CONFIG_READ])
  return (
    <div className="min-h-screen bg-gray-50">
      <AccountMappingPanel />
    </div>
  )
}
