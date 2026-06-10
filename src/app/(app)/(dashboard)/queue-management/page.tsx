import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import QueueDashboard from './_components/QueueDashboard'

export const metadata = { title: 'Queue Management' }

export default async function Page() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  return (
    <div className="min-h-screen bg-gray-50">
      <QueueDashboard />
    </div>
  )
}
