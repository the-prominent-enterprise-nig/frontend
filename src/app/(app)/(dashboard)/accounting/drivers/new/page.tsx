import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { canAny } from '@/src/libs/guards/permission'
import { DriverForm } from '../_components/DriverForm'
import { DRIVER_ACCESS } from '@/src/libs/guards/shared-ownership'

export const metadata = { title: 'Add Driver | NIG Central' }

export default async function NewDriverPage() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!canAny(session, DRIVER_ACCESS.CREATE)) redirect('/403')

  return <DriverForm branchLocked={Boolean(session.branchId)} />
}
