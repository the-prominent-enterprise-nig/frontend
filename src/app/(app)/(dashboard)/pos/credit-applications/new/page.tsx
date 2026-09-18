import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { CREDIT_PERMISSIONS } from '@/src/libs/guards/credit-permissions'
import NewCreditApplicationForm from '../_components/NewCreditApplicationForm'

export const metadata = {
  title: 'New Credit Application | Prominent Enterprise',
  description: 'Raise an in-house financing application for a customer',
}

export default async function NewCreditApplicationPage({
  searchParams,
}: {
  searchParams: Promise<{ applicantCustomerId?: string; applicantName?: string }>
}) {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')

  // Stricter than the queue's own APPLICATION_VIEW gate — a Credit
  // Investigator can read the queue but must not raise applications.
  if (!can(session, CREDIT_PERMISSIONS.APPLICATION_CREATE)) redirect('/403')

  const { applicantCustomerId, applicantName } = await searchParams

  return (
    <div className="min-h-screen bg-zinc-50">
      <NewCreditApplicationForm
        sessionBranchId={session.branchId}
        initialApplicantCustomerId={applicantCustomerId}
        initialApplicantLabel={applicantName}
      />
    </div>
  )
}
