import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { POS_PERMISSIONS } from '@/src/libs/guards/pos-permissions'
import { ServiceJobsList } from './_components/ServiceJobsList'

export const metadata = {
  title: 'Service Jobs | Prominent Enterprise',
  description: 'Create and manage reopenable service job material estimates',
}

export default async function ServiceJobsPage() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!can(session, POS_PERMISSIONS.SERVICE_DRAFTS_READ)) redirect('/pos')

  return (
    <div className="min-h-screen bg-zinc-50">
      <ServiceJobsList session={session} />
    </div>
  )
}
