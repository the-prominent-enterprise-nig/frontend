import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import APBillsList from './_components/APBillsList'

export const metadata = { title: 'AP Bills' }
export default async function Page() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  return (
    <div className="min-h-screen bg-gray-50">
      <APBillsList />
    </div>
  )
}
