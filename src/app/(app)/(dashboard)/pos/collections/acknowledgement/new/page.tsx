import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { POS_PERMISSIONS } from '@/src/libs/guards/pos-permissions'
import NewAcknowledgementReceiptForm from './_components/NewAcknowledgementReceiptForm'

export const metadata = { title: 'New Acknowledgement Receipt' }
export default async function Page() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!can(session, POS_PERMISSIONS.COLLECTIONS_MANAGE)) redirect('/403')
  // A branch-assigned caller is restricted to their own branch server-side
  // too (the service stores actorBranchId regardless of what's submitted) —
  // mirrored here so the form doesn't even offer a branch picker that would
  // just get overridden. Same idiom as financing-terms/page.tsx.
  const restrictedBranchId = session.branchId ?? null
  return (
    <div className="min-h-screen bg-gray-50">
      <NewAcknowledgementReceiptForm restrictedBranchId={restrictedBranchId} />
    </div>
  )
}
