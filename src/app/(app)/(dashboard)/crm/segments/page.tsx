import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { CRM_PERMISSIONS } from '@/src/libs/guards/crm-permissions'
import SegmentsList from './_components/SegmentsList'

export const metadata = { title: 'Segments | CRM' }

export default async function SegmentsPage() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!can(session, CRM_PERMISSIONS.SEGMENTS_READ)) redirect('/403')

  return <SegmentsList />
}
