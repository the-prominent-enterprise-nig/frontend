import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import CashForecastView from './_components/CashForecastView'

export const metadata = { title: 'Cash Forecast' }
export default async function Page() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  return (
    <div className="min-h-screen bg-gray-50">
      <CashForecastView />
    </div>
  )
}
