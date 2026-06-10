import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import BudgetsList from './_components/BudgetsList'

export const metadata = { title: 'Budgets' }
export default async function Page() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  return (
    <div className="min-h-screen bg-gray-50">
      <BudgetsList />
    </div>
  )
}
