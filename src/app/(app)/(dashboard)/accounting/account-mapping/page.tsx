import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import AccountMappingPanel from './_components/AccountMappingPanel'

export const metadata = { title: 'Account Mapping' }
export default async function Page() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  return (
    <div className="min-h-screen bg-gray-50">
      <AccountMappingPanel />
    </div>
  )
}
