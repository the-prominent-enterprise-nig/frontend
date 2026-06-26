import { getSessionOrNull } from '@/src/libs/auth/actions'
import { isAdmin, canAccessModule } from '@/src/libs/guards/permission'
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

  // Non-admins: redirect to the first module their role allows access to.
  // Uses canAccessModule (respects ROLE_MODULE_ACCESS allowlists) so a cashier
  // with inventory:items:read doesn't get sent to /inventory.
  for (const mod of MODULES) {
    if (canAccessModule(session, mod.key)) {
      redirect(mod.href)
    }
  }

  // Branch managers land on the main dashboard (same as owner)
  if (session.primaryRole === 'Branch Manager') {
    redirect('/dashboard')
  }

  redirect('/403')
}
