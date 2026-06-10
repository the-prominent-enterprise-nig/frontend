import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { MobileCountInterface } from './_components'

export const metadata = {
  title: 'Mobile Count | Prominent Enterprise',
  description: 'Barcode-driven mobile stock counting interface',
}

export default async function MobileCountPage() {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  if (!can(session, INVENTORY_PERMISSIONS.MOBILE_COUNT_USE)) {
    redirect('/403')
  }

  return <MobileCountInterface session={session} />
}
