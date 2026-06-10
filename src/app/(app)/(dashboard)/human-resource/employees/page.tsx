import { EmployeeMasterlist } from './_components'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { HR_PERMISSIONS } from '@/src/libs/guards/hr-permissions'
import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Employee Masterlist | Prominent Enterprise',
  description: 'Manage employee records and view employee information',
}

export default async function EmployeesPage() {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  if (!can(session, HR_PERMISSIONS.EMPLOYEES_READ)) {
    redirect('/403')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <EmployeeMasterlist session={session} />
    </div>
  )
}
