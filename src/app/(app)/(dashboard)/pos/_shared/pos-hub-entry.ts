import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { resolvePosTabHref, visiblePosTabHrefs, type PosHub } from './pos-hubs'

/**
 * What a hub's entry route does: send the caller to the first tab they can
 * actually open. The tabs are separate routes, so there is no page behind the
 * sidebar item — only the choice of which one to land on. A tab fronting a
 * second row lands on the first page of that row they can open.
 */
export async function redirectToFirstPosTab(hub: PosHub): Promise<never> {
  const session = await getSessionOrNull()

  if (!session) redirect('/login')

  const visibleHrefs = visiblePosTabHrefs(session)
  for (const tab of hub.tabs) {
    const href = resolvePosTabHref(tab, visibleHrefs)
    if (href) redirect(href)
  }

  redirect('/403')
}
