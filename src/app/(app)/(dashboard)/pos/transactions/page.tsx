import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import TransactionsList from './_components/TransactionsList'

export const metadata = {
  title: 'Transactions | Prominent Enterprise',
}

export default async function TransactionsPage() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')

  return <TransactionsList session={session} />
}
