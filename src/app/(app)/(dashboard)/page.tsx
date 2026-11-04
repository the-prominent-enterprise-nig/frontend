import { getSessionOrNull } from '@/src/libs/auth/actions'
import { isAdmin, canNavigateModule } from '@/src/libs/guards/permission'
import { MODULES } from '@/src/libs/guards/modules'
import { redirect } from 'next/navigation'

/** Primary role (lowercase) → the module it lands in after login. */
const HOME_MODULE: Record<string, string> = {
  cashier: 'pos',
}

export default async function RootPage() {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  if (isAdmin(session)) {
    redirect('/dashboard')
  }

  // A role whose work is one module lands there, whatever else it holds: the
  // Cashier works the till, so POS, not Accounting (which sorts first) now
  // that the sheet gives them Expenses, CRM and Inventory too.
  const home = HOME_MODULE[session.primaryRole?.toLowerCase() ?? '']
  const homeModule = home && MODULES.find((m) => m.key === home)
  if (homeModule && canNavigateModule(session, homeModule.key)) {
    redirect(homeModule.href)
  }

  // Non-admins: redirect to the first module their role allows access to.
  // Uses the roles' own rows, so a role that only reaches a module through what
  // its features bring (Aircool Staff's CRM brings Accounting reads) isn't sent to
  // an /accounting with nothing of theirs in it (403 right after login).
  for (const mod of MODULES) {
    if (canNavigateModule(session, mod.key)) {
      redirect(mod.href)
    }
  }

  redirect('/403')
}
