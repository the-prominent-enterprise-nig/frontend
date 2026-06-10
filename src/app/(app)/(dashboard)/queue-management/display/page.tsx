import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import QueueDisplay from '../_components/QueueDisplay'

export const metadata = { title: 'Queue Display' }

export default async function Page() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  return <QueueDisplay />
}
