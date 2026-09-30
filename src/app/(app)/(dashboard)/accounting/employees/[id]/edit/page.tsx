import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import { EmployeeForm } from '../../_components'

export const metadata = {
  title: 'Edit Employee | NIG Central',
  description: 'Edit an employee',
}

export default async function EditEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  if (!can(session, ACCOUNTING_PERMISSIONS.EMPLOYEE_UPDATE)) {
    redirect('/403')
  }

  const { id } = await params

  return (
    <div className="min-h-screen bg-zinc-50">
      <EmployeeForm id={id} />
    </div>
  )
}
