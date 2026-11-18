import { Suspense } from 'react'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can, isAdmin } from '@/src/libs/guards/permission'
import { redirect } from 'next/navigation'
import { getBranches } from '../_actions/get-branches'
import { BranchesHub } from './_components/BranchesHub'

export const metadata = {
  title: 'Branches | NIG Central',
}

export default async function BranchesSettingsPage() {
  const session = await getSessionOrNull()

  if (!session) redirect('/login')
  if (!isAdmin(session)) redirect('/403')

  const result = await getBranches()
  const branches = result.success && result.data ? result.data : []

  return (
    <Suspense fallback={<div className="min-h-full bg-zinc-50" />}>
      <BranchesHub
        session={session}
        initialBranches={branches}
        canManageBranches={can(session, 'admin:branches:manage')}
      />
    </Suspense>
  )
}
