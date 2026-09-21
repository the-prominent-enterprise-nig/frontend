import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { POS_PERMISSIONS } from '@/src/libs/guards/pos-permissions'
import AcknowledgementReceiptDetail from './_components/AcknowledgementReceiptDetail'

export const metadata = { title: 'Acknowledgement Receipt' }
export default async function Page() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!can(session, POS_PERMISSIONS.COLLECTIONS_MANAGE)) redirect('/403')
  return (
    <div className="min-h-screen bg-gray-50">
      <AcknowledgementReceiptDetail />
    </div>
  )
}
