import { getSessionOrNull } from '@/src/libs/auth/actions'
import { isAdmin } from '@/src/libs/guards/permission'
import { redirect, notFound } from 'next/navigation'
import { getRole, getPermissions } from '../../_actions'
import RoleAccessClient from './_components/RoleAccessClient'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await getRole(id)
  return {
    title: result.data ? `${result.data.name} | Roles & Access` : 'Role | Prominent Enterprise',
  }
}

export default async function RoleAccessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!isAdmin(session)) redirect('/403')

  const [roleResult, permissionsResult] = await Promise.all([getRole(id), getPermissions()])

  if (!roleResult.success || !roleResult.data) notFound()

  const permissions =
    permissionsResult.success && permissionsResult.data
      ? Array.isArray(permissionsResult.data)
        ? permissionsResult.data
        : permissionsResult.data.data
      : []

  return <RoleAccessClient role={roleResult.data} availablePermissions={permissions} />
}
