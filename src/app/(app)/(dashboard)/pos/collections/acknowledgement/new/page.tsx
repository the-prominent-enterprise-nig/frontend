import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can, canAny } from '@/src/libs/guards/permission'
import { POS_PERMISSIONS } from '@/src/libs/guards/pos-permissions'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import NewAcknowledgementReceiptForm from './_components/NewAcknowledgementReceiptForm'

export const metadata = { title: 'New Acknowledgement Receipt' }
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
  // A branch-assigned caller is restricted to their own branch server-side
  // too (the service stores actorBranchId regardless of what's submitted) —
  // mirrored here so the form doesn't even offer a branch picker that would
  // just get overridden. Same idiom as financing-terms/page.tsx.
  const restrictedBranchId = session.branchId ?? null
  return (
    <div className="min-h-screen bg-gray-50">
      <NewAcknowledgementReceiptForm
        restrictedBranchId={restrictedBranchId}
        acknowledgementOnly={!can(session, ACCOUNTING_PERMISSIONS.AR_INVOICES_PAY)}
      />
    </div>
  )
}
