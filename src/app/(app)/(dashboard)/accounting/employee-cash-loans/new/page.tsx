import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import NewLoanForm from './_components/NewLoanForm'

export const metadata = {
  title: 'New Employee Cash Loan | NIG Central',
  description: 'Issue a new employee cash loan',
}

export default async function NewEmployeeCashLoanPage() {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  if (!can(session, ACCOUNTING_PERMISSIONS.EMPLOYEE_CASH_LOAN_CREATE)) {
    redirect('/403')
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <NewLoanForm />
    </div>
  )
}
