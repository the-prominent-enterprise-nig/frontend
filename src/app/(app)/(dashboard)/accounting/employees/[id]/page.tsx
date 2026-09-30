import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import EmployeeDetail from './_components/EmployeeDetail'

export const metadata = {
  title: 'Employee | Prominent Enterprise',
  description: 'Employee detail',
}

export default async function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  if (!can(session, ACCOUNTING_PERMISSIONS.EMPLOYEE_READ)) {
    redirect('/403')
  }

  const { id } = await params

  return (
    <div className="min-h-screen bg-zinc-50">
      <EmployeeDetail id={id} session={session} />
    </div>
  )
}
