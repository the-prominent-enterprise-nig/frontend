import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { POS_PERMISSIONS } from '@/src/libs/guards/pos-permissions'
import TransactionPage from '../_components/TransactionPage'

export const metadata = {
  title: 'Transaction | NIG Central',
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<React.JSX.Element> {
  const session = requirePermission(await getSessionOrNull(), POS_PERMISSIONS.TRANSACTIONS_READ)
  const { id } = await params

  return <TransactionPage id={id} session={session} />
}
