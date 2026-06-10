import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import BankRecon from './_components/BankRecon'

export const metadata = { title: 'Bank Reconciliation' }
export default async function Page() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  return (
    <div className="min-h-screen bg-gray-50">
      <BankRecon />
    </div>
  )
}
