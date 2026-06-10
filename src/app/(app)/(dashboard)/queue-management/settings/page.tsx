import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import QueueSettings from '../_components/QueueSettings'

export const metadata = { title: 'Queue Settings' }

export default async function Page() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  return (
    <div className="min-h-screen bg-gray-50">
      <QueueSettings />
    </div>
  )
}
