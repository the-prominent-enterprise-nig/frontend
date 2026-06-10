import { getSessionOrNull } from '@/src/libs/auth/actions'
import { isAdmin } from '@/src/libs/guards/permission'
import PermissionsSection from '@/src/components/settings/PermissionsSection'
import { getPermissions } from '../_actions'
import { redirect } from 'next/navigation'

export default async function PermissionsPage() {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  if (!isAdmin(session)) {
    redirect('/403')
  }

  // Fetch permissions server-side
  const result = await getPermissions()

  // Handle error case
  if (!result.success || !result.data) {
    return (
      <div className="min-h-full bg-zinc-50 px-6 py-6">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
            <p className="text-red-600">
              Failed to load permissions: {result.error || 'Unknown error'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Normalize response: handle both array and paginated response
  const permissions = Array.isArray(result.data) ? result.data : result.data.data

  return (
    <div className="min-h-full bg-zinc-50 px-6 py-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-3xl font-semibold text-zinc-900">Permissions</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Define permissions using the{' '}
            <span className="font-mono text-xs">module:resource:action</span> format.
          </p>
        </div>
        <PermissionsSection initialPermissions={permissions} />
      </div>
    </div>
  )
}
