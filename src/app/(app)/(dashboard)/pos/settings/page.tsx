import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { visiblePosSettingsHrefs } from '../_shared/pos-hubs'

// The first Settings page this person can open: General for most, but a role
// holding one settings toggle (Terminals, say) goes to its own page.
export default async function PosSettingsIndexPage() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  redirect(visiblePosSettingsHrefs(session)[0] ?? '/403')
}
