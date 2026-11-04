import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can, isAdmin, managesOwnBranch } from '@/src/libs/guards/permission'
import { redirect, notFound } from 'next/navigation'
import { getBranch } from '../../_actions/get-branch'
import { getBranchSummary } from '../../_actions/get-branch-summary'
import { getBranchPaymentMethods } from './_actions/branch-payment-methods'
import BranchDetailClient from './_components/BranchDetailClient'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await getBranch(id)
  return {
    title: result.data ? `${result.data.name} | Branches` : 'Branch | NIG Central',
  }
}

export default async function BranchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const session = await getSessionOrNull()
  if (!session) redirect('/login')

  const isBranchManager = managesOwnBranch(session)
  if (!isAdmin(session) && !isBranchManager) redirect('/403')
  if (isBranchManager && session.branchId !== id) redirect('/403')

  const [branchResult, summaryResult, paymentMethodsResult] = await Promise.all([
    getBranch(id),
    getBranchSummary(id),
    getBranchPaymentMethods(id),
  ])

  if (!branchResult.success || !branchResult.data) notFound()

  return (
    <BranchDetailClient
      branch={branchResult.data}
      summary={summaryResult.data ?? null}
      canManageBranch={can(session, 'admin:branches:manage')}
      isBranchManager={isBranchManager}
      initialPaymentMethods={paymentMethodsResult.data?.data ?? []}
    />
  )
}
