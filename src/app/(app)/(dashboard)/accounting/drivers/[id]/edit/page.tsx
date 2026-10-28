import { notFound, redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { canAny } from '@/src/libs/guards/permission'
import { getDriver } from '../../_actions/get-driver'
import { DriverForm } from '../../_components/DriverForm'
import { DRIVER_ACCESS } from '@/src/libs/guards/shared-ownership'

export const metadata = { title: 'Edit Driver | NIG Central' }

export default async function EditDriverPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!canAny(session, DRIVER_ACCESS.UPDATE)) redirect('/403')

  const { id } = await params
  const result = await getDriver(id)
  if (!result.success || !result.data) notFound()

  return <DriverForm driver={result.data} branchLocked={Boolean(session.branchId)} />
}
