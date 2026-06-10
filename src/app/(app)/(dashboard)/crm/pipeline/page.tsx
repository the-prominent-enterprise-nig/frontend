import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { CRM_PERMISSIONS } from '@/src/libs/guards/crm-permissions'
import PipelineView from './_components/PipelineView'

export const metadata = { title: 'Pipeline | CRM' }

export default async function PipelinePage() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!can(session, CRM_PERMISSIONS.PIPELINE_READ)) redirect('/403')

  return <PipelineView />
}
