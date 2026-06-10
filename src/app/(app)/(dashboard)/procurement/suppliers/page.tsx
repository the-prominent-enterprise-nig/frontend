import { redirect } from 'next/navigation'
import { SupplierMasterlist } from './_components'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { PROCUREMENT_PERMISSIONS } from '@/src/libs/guards/procurement-permissions'

export const metadata = {
  title: 'Suppliers | Prominent Enterprise',
  description: 'Manage supplier records, payment terms, and compliance.',
}

export default async function SuppliersPage() {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  if (!can(session, PROCUREMENT_PERMISSIONS.SUPPLIERS_READ)) {
    redirect('/403')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <SupplierMasterlist />
    </div>
  )
}
