import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import LoanDetail from './_components/LoanDetail'

export const metadata = { title: 'Employee Appliance Loan' }
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSessionOrNull()
  requirePermission(session, ACCOUNTING_PERMISSIONS.EMPLOYEE_APPLIANCE_LOAN_READ)
  return <LoanDetail id={id} />
}
