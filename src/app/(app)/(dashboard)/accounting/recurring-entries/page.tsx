import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import RecurringList from './_components/RecurringList'

export const metadata = { title: 'Recurring Entries' }
export default async function Page() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  return (
    <div className="min-h-screen bg-gray-50">
      <RecurringList />
    </div>
  )
}
