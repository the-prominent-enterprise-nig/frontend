import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import QueueReports from '../_components/QueueReports'

export const metadata = { title: 'Queue Reports' }

export default async function Page() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  return (
    <div className="min-h-screen bg-gray-50">
      <QueueReports />
    </div>
  )
}
