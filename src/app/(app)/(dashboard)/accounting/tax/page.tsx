import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import TaxPanel from './_components/TaxPanel'

export const metadata = { title: 'Tax' }
export default async function Page() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  return (
    <div className="min-h-screen bg-gray-50">
      <TaxPanel session={session} />
    </div>
  )
}
