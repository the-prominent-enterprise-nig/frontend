import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import TaxRatesList from './_components/TaxRatesList'

export const metadata = { title: 'Tax Rates' }
export default async function Page() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  return (
    <div className="min-h-screen bg-gray-50">
      <TaxRatesList />
    </div>
  )
}
