import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can, canAny } from '@/src/libs/guards/permission'
import { POS_PERMISSIONS } from '@/src/libs/guards/pos-permissions'
import AcknowledgementReceiptsList from './_components/AcknowledgementReceiptsList'

export const metadata = { title: 'Acknowledgement Receipts' }
export default async function Page() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  // pos:acknowledgement-receipts:create opens New Receipts for acknowledgment
  // receipts only (Access Levels Part 2); the server forces the type.
  if (
    !canAny(session, [
      POS_PERMISSIONS.COLLECTIONS_MANAGE,
      POS_PERMISSIONS.ACKNOWLEDGEMENT_RECEIPTS_CREATE,
    ])
  )
    redirect('/403')
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Import takes a file of either receipt type, so it stays on the full
          permission. */}
      <AcknowledgementReceiptsList canImport={can(session, POS_PERMISSIONS.COLLECTIONS_MANAGE)} />
    </div>
  )
}
