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
  // Same idiom as the create form's own restrictedBranchId — a
  // branch-assigned caller can't move a receipt to a different branch when
  // editing, so the edit panel locks to it instead of offering a picker.
  const restrictedBranchId = session.branchId ?? null
  return (
    <div className="min-h-screen bg-gray-50">
      <AcknowledgementReceiptDetail restrictedBranchId={restrictedBranchId} />
    </div>
  )
}
