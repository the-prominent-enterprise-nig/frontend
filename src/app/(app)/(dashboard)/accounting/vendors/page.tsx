import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import VendorsList from './_components/VendorsList'

export const metadata = {
  title: 'Vendors | Prominent Enterprise',
  description: 'Manage vendor records',
}

export default async function VendorsPage() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!can(session, ACCOUNTING_PERMISSIONS.VENDOR_READ)) redirect('/403')

  return (
    <div className="min-h-screen bg-zinc-50">
      <VendorsList session={session} />
    </div>
  )
}
