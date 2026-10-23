import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import { PrefetchBoundary } from '@/src/components/ssr/PrefetchBoundary'
import { EmployeesList } from './_components'
import { employeeQueries } from './_queries'

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

  // One fast query, so no Suspense and no loading.tsx on purpose: React holds
  // back the reveal of Suspense content for ~300 ms after showing a fallback,
  // which is slower than simply waiting the ~30 ms this takes. The first HTML
  // flush already contains the rows. Reserve Suspense for sections that really
  // are slow (see the aging report).
  return (
    <div className="min-h-screen bg-zinc-50">
      <PrefetchBoundary
        prefetch={(queryClient) => queryClient.prefetchQuery(employeeQueries.list())}
      >
        <EmployeesList session={session} />
      </PrefetchBoundary>
    </div>
  )
}
