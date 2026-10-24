import { getSessionOrNull } from '@/src/libs/auth/actions'
import { isAdmin } from '@/src/libs/guards/permission'
import { redirect } from 'next/navigation'
import { getPermissions } from '../../_actions'
import CreateRoleClient from './_components/CreateRoleClient'

export const metadata = {
  title: 'Create Role | Prominent Enterprise',
}

export default async function CreateRolePage() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!isAdmin(session)) redirect('/403')

  const permissionsResult = await getPermissions()
  const permissions =
    permissionsResult.success && permissionsResult.data
      ? Array.isArray(permissionsResult.data)
        ? permissionsResult.data
        : permissionsResult.data.data
      : []

  return <CreateRoleClient availablePermissions={permissions} />
}
