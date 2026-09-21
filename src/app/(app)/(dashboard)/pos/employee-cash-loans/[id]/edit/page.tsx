import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { POS_PERMISSIONS } from '@/src/libs/guards/pos-permissions'
import EditLoanForm from '../_components/EditLoanForm'

export const metadata = {
  title: 'Edit Employee Cash Loan | Prominent Enterprise',
  description: 'Edit an employee cash loan',
}

export default async function EditEmployeeCashLoanPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  if (!can(session, POS_PERMISSIONS.EMPLOYEE_CASH_LOAN_CREATE)) {
    redirect('/403')
  }

  const { id } = await params

  return (
    <div className="min-h-screen bg-zinc-50">
      <EditLoanForm id={id} />
    </div>
  )
}
