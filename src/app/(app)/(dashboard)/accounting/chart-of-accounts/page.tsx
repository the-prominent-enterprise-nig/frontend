import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import { ChartOfAccountsList } from './_components/ChartOfAccountsList'

export const metadata = {
  title: 'Chart of Accounts | Prominent Enterprise',
  description: 'Manage accounting accounts',
}

export default async function ChartOfAccountsPage() {
  const session = await getSessionOrNull()
  const user = requirePermission(session, ACCOUNTING_PERMISSIONS.ACCOUNT_READ)
  return <ChartOfAccountsList session={user} />
}
