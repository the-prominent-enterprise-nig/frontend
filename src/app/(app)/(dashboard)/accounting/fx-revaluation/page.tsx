import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import FxRevaluationView from './_components/FxRevaluationView'

export const metadata = { title: 'FX Revaluation' }
export default async function Page() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  return (
    <div className="min-h-screen bg-gray-50">
      <FxRevaluationView />
    </div>
  )
}
