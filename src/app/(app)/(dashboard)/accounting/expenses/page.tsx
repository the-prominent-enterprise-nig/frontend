import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import ExpensesList from './_components/ExpensesList'

export const metadata = { title: 'Expenses' }
export default async function Page() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  return (
    <div className="min-h-screen bg-gray-50">
      <ExpensesList />
    </div>
  )
}
