import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import APPaymentMethodsPanel from './_components/APPaymentMethodsPanel'

export const metadata = { title: 'AP Payment Methods' }
export default async function Page() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  return (
    <div className="min-h-screen bg-gray-50">
      <APPaymentMethodsPanel />
    </div>
  )
}
