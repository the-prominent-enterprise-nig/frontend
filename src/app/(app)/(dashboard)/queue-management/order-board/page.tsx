import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import OrderBoard from '../_components/OrderBoard'

export const metadata = { title: 'Order Board' }

export default async function Page() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  return <OrderBoard />
}
