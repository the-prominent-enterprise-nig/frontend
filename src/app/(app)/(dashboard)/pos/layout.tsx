import ModuleGuard from '@/src/components/guards/ModuleGuard'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { canManagePosSettings } from '@/src/libs/guards/permission'
import { PosTopBar } from './_components/PosTopBar'
import { StaleSessionPrompt } from './_components/StaleSessionPrompt'
import { visiblePosTabHrefs } from './_shared/pos-hubs'

export const metadata = {
  title: 'Point of Sale - NIG Central',
  description: 'Point of Sale operations',
}

export default async function PosLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionOrNull()
  const userId = session?.id ?? null
  const canConfigurePos = session ? canManagePosSettings(session) : false

  return (
    <ModuleGuard module="pos">
      <div className="flex h-full flex-col">
        <PosTopBar
          canConfigurePos={canConfigurePos}
          userId={userId}
          visibleTabHrefs={visiblePosTabHrefs(session)}
        />
        {/* The Checkout block shares this one grid cell with the page, so it
            covers just the page area and the tabs and sidebar stay clickable.
            Grid, not `relative` + absolute: a positioned wrapper would change
            what the pages' own absolute elements (e.g. full-content modals)
            are placed against. */}
        <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-1">
          <div className="col-start-1 row-start-1 overflow-auto">{children}</div>
          <StaleSessionPrompt userId={userId} />
        </div>
      </div>
    </ModuleGuard>
  )
}
