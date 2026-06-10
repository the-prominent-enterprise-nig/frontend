import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import FiscalPeriodsList from './_components/FiscalPeriodsList'

export const metadata = { title: 'Fiscal Periods' }
export default async function Page() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  return (
    <div className="min-h-screen bg-gray-50">
      <FiscalPeriodsList />
    </div>
  )
}
