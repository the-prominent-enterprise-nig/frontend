import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { POS_PERMISSIONS } from '@/src/libs/guards/pos-permissions'
import { EmployeeCashLoansList } from './_components'

export const metadata = {
  title: 'Employee Cash Loans | Prominent Enterprise',
  description: 'Issue and track employee cash loans from POS',
}

export default async function EmployeeCashLoansPage() {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  if (!can(session, POS_PERMISSIONS.EMPLOYEE_CASH_LOAN_READ)) {
    redirect('/403')
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <EmployeeCashLoansList session={session} />
    </div>
  )
}
