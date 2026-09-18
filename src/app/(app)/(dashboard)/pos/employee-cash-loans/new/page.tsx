import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { POS_PERMISSIONS } from '@/src/libs/guards/pos-permissions'
import NewLoanForm from './_components/NewLoanForm'

export const metadata = {
  title: 'New Employee Cash Loan | Prominent Enterprise',
  description: 'Issue a new employee cash loan from POS',
}

export default async function NewEmployeeCashLoanPage() {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  if (!can(session, POS_PERMISSIONS.EMPLOYEE_CASH_LOAN_CREATE)) {
    redirect('/403')
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <NewLoanForm />
    </div>
  )
}
