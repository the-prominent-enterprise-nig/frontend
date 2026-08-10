import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { POS_PERMISSIONS } from '@/src/libs/guards/pos-permissions'
import TransactionsList from './_components/TransactionsList'

export const metadata = {
  title: 'Transactions | Prominent Enterprise',
}

export default async function TransactionsPage() {
  const sessionOrNull = await getSessionOrNull()
  const session = requirePermission(sessionOrNull, POS_PERMISSIONS.TRANSACTIONS_READ)

  return <TransactionsList session={session} />
}
