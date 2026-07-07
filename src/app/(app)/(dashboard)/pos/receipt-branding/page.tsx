import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import ReceiptBrandingClient from './_components/ReceiptBrandingClient'

export const metadata = { title: 'Receipt Branding' }

export default async function ReceiptBrandingPage() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')

  const isBranchManager = session.primaryRole === 'Branch Manager'
  const ownBranch = isBranchManager
    ? (session.branches.find((b) => b.id === session.branchId) ?? null)
    : null

  return <ReceiptBrandingClient isBranchManager={isBranchManager} ownBranch={ownBranch} />
}
