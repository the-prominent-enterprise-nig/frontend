import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { CRM_PERMISSIONS } from '@/src/libs/guards/crm-permissions'
import PipelineStagesSettings from './_components/PipelineStagesSettings'

export const metadata = { title: 'CRM Settings' }

export default async function CrmSettingsPage() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!can(session, CRM_PERMISSIONS.PIPELINE_MANAGE)) redirect('/403')

  return <PipelineStagesSettings tenantId={session.enterpriseOwnerId ?? session.id} />
}
