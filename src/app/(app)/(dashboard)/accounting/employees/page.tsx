import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import { EmployeesList } from './_components'

export const metadata = {
  title: 'Employees | NIG Central',
  description: 'The Employees master list',
}

export default async function EmployeesPage() {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  if (!can(session, ACCOUNTING_PERMISSIONS.EMPLOYEE_READ)) {
    redirect('/403')
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <EmployeesList session={session} />
    </div>
  )
}
