import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import { EmployeeForm } from '../_components'

export const metadata = {
  title: 'Add Employee | Prominent Enterprise',
  description: 'Add a new employee to the master list',
}

export default async function NewEmployeePage() {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  if (!can(session, ACCOUNTING_PERMISSIONS.EMPLOYEE_CREATE)) {
    redirect('/403')
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <EmployeeForm />
    </div>
  )
}
