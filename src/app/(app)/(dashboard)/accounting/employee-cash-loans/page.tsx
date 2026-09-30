import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import { EmployeeCashLoansList } from './_components'

export const metadata = {
  title: 'Employee Cash Loans | NIG Central',
  description: 'Issue and track employee cash loans',
}

export default async function EmployeeCashLoansPage({
  searchParams,
}: {
  searchParams: Promise<{ employeeId?: string }>
}) {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  if (!can(session, ACCOUNTING_PERMISSIONS.EMPLOYEE_CASH_LOAN_READ)) {
    redirect('/403')
  }

  const { employeeId } = await searchParams

  return (
    <div className="min-h-screen bg-zinc-50">
      <EmployeeCashLoansList session={session} employeeId={employeeId} />
    </div>
  )
}
