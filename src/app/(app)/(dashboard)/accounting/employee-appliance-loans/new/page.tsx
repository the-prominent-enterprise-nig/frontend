import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import NewLoanForm from './_components/NewLoanForm'

export const metadata = { title: 'New Employee Appliance Loan' }
export default async function Page() {
  const session = await getSessionOrNull()
  requirePermission(session, ACCOUNTING_PERMISSIONS.EMPLOYEE_APPLIANCE_LOAN_CREATE)
  return <NewLoanForm />
}
