import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import EmployeeApplianceLoansList from './_components/EmployeeApplianceLoansList'

export const metadata = { title: 'Employee Appliance Loans' }
export default async function Page() {
  const session = await getSessionOrNull()
  requirePermission(session, ACCOUNTING_PERMISSIONS.EMPLOYEE_APPLIANCE_LOAN_READ)
  return (
    <div className="min-h-screen bg-gray-50">
      <EmployeeApplianceLoansList />
    </div>
  )
}
