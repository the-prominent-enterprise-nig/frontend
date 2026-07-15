import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { PROCUREMENT_PERMISSIONS } from '@/src/libs/guards/procurement-permissions'
import SupplierDirectory from './_components/SupplierDirectory'

export const metadata = {
  title: 'Suppliers | Prominent Enterprise',
  description: 'Manage supplier catalogue and item mappings',
}

export default async function SuppliersPage() {
  const session = await getSessionOrNull()

  if (!session) redirect('/login')
  if (!can(session, PROCUREMENT_PERMISSIONS.SUPPLIERS_READ)) redirect('/403')

  return (
    <div className="min-h-screen bg-zinc-50">
      <SupplierDirectory session={session} />
    </div>
  )
}
