import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import BankAccountsList from './_components/BankAccountsList'

export const metadata = { title: 'Bank Accounts' }
export default async function Page() {
  const session = await getSessionOrNull()
  requirePermission(session, ACCOUNTING_PERMISSIONS.BANK_ACCOUNTS_READ)
  return (
    <div className="min-h-screen bg-gray-50">
      <BankAccountsList />
    </div>
  )
}
