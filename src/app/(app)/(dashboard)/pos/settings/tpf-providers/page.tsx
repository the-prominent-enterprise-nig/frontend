import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { POS_PERMISSIONS } from '@/src/libs/guards/pos-permissions'
import { TpfProviderList } from './_components/TpfProviderList'

export const metadata = { title: 'TPF Providers | Prominent Enterprise' }

export default async function TpfProvidersPage() {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  if (!can(session, POS_PERMISSIONS.TPF_PROVIDERS_READ)) {
    redirect('/403')
  }

  const canManage = can(session, POS_PERMISSIONS.TPF_PROVIDERS_MANAGE)

  return <TpfProviderList canManage={canManage} />
}
