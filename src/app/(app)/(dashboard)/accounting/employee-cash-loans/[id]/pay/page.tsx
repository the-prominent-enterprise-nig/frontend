import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import PayLoanForm from './_components/PayLoanForm'

export const metadata = {
  title: 'Pay Employee Cash Loan | Prominent Enterprise',
  description: 'Record a payment against an Others cash loan',
}

export default async function PayEmployeeCashLoanPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  if (!can(session, ACCOUNTING_PERMISSIONS.EMPLOYEE_CASH_LOAN_PAY)) {
    redirect('/403')
  }

  const { id } = await params

  return (
    <div className="min-h-screen bg-zinc-50">
      <PayLoanForm id={id} />
    </div>
  )
}
