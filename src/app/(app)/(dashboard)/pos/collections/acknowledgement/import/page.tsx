import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { POS_PERMISSIONS } from '@/src/libs/guards/pos-permissions'
import ImportReceiptsView from './_components/ImportReceiptsView'

export const metadata = { title: 'Import Receipts' }
export default async function Page() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!can(session, POS_PERMISSIONS.COLLECTIONS_MANAGE)) redirect('/403')
  return (
    <div className="min-h-screen bg-gray-50">
      <ImportReceiptsView />
    </div>
  )
}
