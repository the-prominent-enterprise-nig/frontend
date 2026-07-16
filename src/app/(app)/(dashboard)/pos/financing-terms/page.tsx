import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { POS_PERMISSIONS } from '@/src/libs/guards/pos-permissions'
import { FinancingTermList } from './_components/FinancingTermList'

export const metadata = { title: 'Financing Terms | Prominent Enterprise' }

export default async function FinancingTermsPage() {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  if (!can(session, POS_PERMISSIONS.FINANCING_TERMS_READ)) {
    redirect('/403')
  }

  const canManage = can(session, POS_PERMISSIONS.FINANCING_TERMS_MANAGE)

  // A branch-assigned caller (Branch Manager) is restricted to their own
  // branch server-side too (FinancingTermsService forces this regardless of
  // what's submitted) — mirrored here so the create form doesn't even offer
  // a branch picker that would just get overridden.
  const restrictedBranchId = session.branchId ?? null

  return <FinancingTermList canManage={canManage} restrictedBranchId={restrictedBranchId} />
}
