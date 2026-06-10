import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import FixedAssetsList from './_components/FixedAssetsList'

export const metadata = { title: 'Fixed Assets' }
export default async function Page() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  return (
    <div className="min-h-screen bg-gray-50">
      <FixedAssetsList />
    </div>
  )
}
