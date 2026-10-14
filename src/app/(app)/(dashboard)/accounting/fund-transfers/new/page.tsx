import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import FundTransferForm from './_components/FundTransferForm'

export const metadata = { title: 'New Inter-Account Transfer' }
export default async function Page() {
  const session = requirePermission(
    await getSessionOrNull(),
    ACCOUNTING_PERMISSIONS.BANK_ACCOUNTS_TRANSFER
  )
  // A branch-assigned user records for their own branch and can't pick another.
  const ownBranch = session.branchId
    ? { id: session.branchId, name: session.branchName ?? 'Your branch' }
    : null
  return <FundTransferForm ownBranch={ownBranch} />
}
