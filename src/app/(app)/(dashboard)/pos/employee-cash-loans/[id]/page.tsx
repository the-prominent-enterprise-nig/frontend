import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { POS_PERMISSIONS } from '@/src/libs/guards/pos-permissions'
import LoanDetail from './_components/LoanDetail'

export const metadata = {
  title: 'Employee Cash Loan | Prominent Enterprise',
  description: 'Employee cash loan detail and schedule',
}

export default async function EmployeeCashLoanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  if (!can(session, POS_PERMISSIONS.EMPLOYEE_CASH_LOAN_READ)) {
    redirect('/403')
  }

  const { id } = await params

  return (
    <div className="min-h-screen bg-zinc-50">
      <LoanDetail id={id} />
    </div>
  )
}
