import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { ChartOfAccountsList } from './_components/ChartOfAccountsList'

export const metadata = {
  title: 'Chart of Accounts | Prominent Enterprise',
  description: 'Manage accounting accounts',
}

export default async function ChartOfAccountsPage() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  return <ChartOfAccountsList session={session} />
}
