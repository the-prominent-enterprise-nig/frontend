import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import ReturnInspectionsList from './_components/ReturnInspectionsList'

export const metadata = {
  title: 'Return Inspections | Prominent Enterprise',
  description:
    'Inspect returned units on pending void/refund requests and move them to Quarantine before manager disposition',
}

export default async function ReturnInspectionsPage() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!can(session, INVENTORY_PERMISSIONS.RETURNS_INSPECT)) redirect('/403')

  return <ReturnInspectionsList />
}
