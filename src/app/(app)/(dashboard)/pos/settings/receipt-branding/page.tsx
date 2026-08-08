import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { POS_PERMISSIONS } from '@/src/libs/guards/pos-permissions'
import ReceiptBrandingClient from './_components/ReceiptBrandingClient'

export const metadata = { title: 'Receipt Branding' }

export default async function ReceiptBrandingPage() {
  const sessionOrNull = await getSessionOrNull()
  const session = requirePermission(sessionOrNull, POS_PERMISSIONS.CONFIG_READ)

  const isBranchManager = session.primaryRole === 'Branch Manager'
  const ownBranch = isBranchManager
    ? (session.branches.find((b) => b.id === session.branchId) ?? null)
    : null

  return <ReceiptBrandingClient isBranchManager={isBranchManager} ownBranch={ownBranch} />
}
