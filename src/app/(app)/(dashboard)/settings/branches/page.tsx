import { getSessionOrNull } from '@/src/libs/auth/actions'
import { isAdmin } from '@/src/libs/guards/permission'
import { redirect } from 'next/navigation'
import { getBranches } from '../_actions/get-branches'
import BranchesSection from './_components/BranchesSection'

export const metadata = {
  title: 'Branches | Prominent Enterprise',
}

export default async function BranchesSettingsPage() {
  const session = await getSessionOrNull()

  if (!session) redirect('/login')
  if (!isAdmin(session)) redirect('/403')

  const result = await getBranches()
  const branches = result.success && result.data ? result.data : []

  return (
    <div className="min-h-full bg-zinc-50 px-6 py-6">
      <div className="mx-auto max-w-7xl">
        <BranchesSection initialBranches={branches} />
      </div>
    </div>
  )
}
