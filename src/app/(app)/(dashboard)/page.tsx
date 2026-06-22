import { getSessionOrNull } from '@/src/libs/auth/actions'
import { isAdmin, can } from '@/src/libs/guards/permission'
import { MODULES } from '@/src/libs/guards/modules'
import { redirect } from 'next/navigation'

export default async function RootPage() {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  if (isAdmin(session)) {
    redirect('/dashboard')
  }

  // Non-admins: redirect to the first module they have the required entry permission for
  for (const mod of MODULES) {
    if (can(session, mod.requiredPermission)) {
      redirect(mod.href)
    }
  }

  // Branch managers land on the main dashboard (same as owner)
  if (session.primaryRole === 'Branch Manager') {
    redirect('/dashboard')
  }

  redirect('/403')
}
