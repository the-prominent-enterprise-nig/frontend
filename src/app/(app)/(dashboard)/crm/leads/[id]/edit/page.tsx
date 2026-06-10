import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { CRM_PERMISSIONS } from '@/src/libs/guards/crm-permissions'
import EditLeadForm from './_components/EditLeadForm'

export const metadata = { title: 'Edit Lead | CRM' }

export default async function EditLeadPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!can(session, CRM_PERMISSIONS.LEADS_UPDATE)) redirect('/403')

  const { id } = await params
  return <EditLeadForm id={id} />
}
