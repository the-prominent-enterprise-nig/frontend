import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { visibleHubTabs, type Hub } from './hubs'

/**
 * What a hub's entry route does: send the caller to the first tab they can
 * actually open. The tabs are separate routes, so there is no page behind the
 * sidebar item — only the choice of which one to land on.
 */
export async function redirectToFirstHubTab(hub: Hub): Promise<never> {
  const session = await getSessionOrNull()

  if (!session) redirect('/login')

  const [first] = visibleHubTabs(hub, session)
  if (!first) redirect('/403')

  redirect(first.href)
}
