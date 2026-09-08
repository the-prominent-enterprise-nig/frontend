import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { isAdmin } from '@/src/libs/guards/permission'
import DepartmentsSection from './_components/DepartmentsSection'

export const metadata = {
  title: 'Departments & Divisions | Prominent Enterprise',
}

// Where the payroll dimensions are maintained. Without this page the
// Expense form's Branch → Department → Division dropdowns would have
// nothing to offer, since neither entity is seeded from anywhere.
export default async function DepartmentsSettingsPage() {
  const session = await getSessionOrNull()

  if (!session) redirect('/login')
  if (!isAdmin(session)) redirect('/403')

  return (
    <div className="min-h-full bg-zinc-50 px-6 py-6">
      <div className="mx-auto max-w-5xl">
        <DepartmentsSection />
      </div>
    </div>
  )
}
