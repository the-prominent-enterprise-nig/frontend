import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import BankAccountsList from './_components/BankAccountsList'

export const metadata = { title: 'Bank Accounts' }
export default async function Page() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  return (
    <div className="min-h-screen bg-gray-50">
      <BankAccountsList />
    </div>
  )
}
