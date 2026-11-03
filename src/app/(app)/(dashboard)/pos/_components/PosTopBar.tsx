'use client'

import { usePathname } from 'next/navigation'
import { PosNav, PosSubNav } from './PosNav'
import { showsPosBranchSwitcher } from '../_shared/pos-hubs'
import { PosBranchSwitcher } from './PosBranchSwitcher'
import { PendingRefundIndicator } from './PendingRefundIndicator'

export function PosTopBar({
  canConfigurePos,
  userId,
  visibleTabHrefs,
}: {
  canConfigurePos: boolean
  userId: string | null
  visibleTabHrefs: string[]
}) {
  const pathname = usePathname()

  // The branch switcher only belongs in this shared bar for the routes whose hub
  // tab is flagged for it (plus Product Catalog). Other routes either surface it
  // inline with their own page title (e.g. /pos/settings/*, Override Review) or
  // — like /pos/pin, which is pure per-user PIN self-service with nothing
  // branch-scoped on the page — don't need it at all.
  const showBranchSwitcher = showsPosBranchSwitcher(pathname)

  return (
    <div className="bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 bg-white">
        <PosNav canConfigurePos={canConfigurePos} visibleHrefs={visibleTabHrefs} />
        {/* ml-auto: PosNav renders nothing on a standalone page or a one-tab hub,
            and justify-between alone would pull this group to the left edge. */}
        <div className="ml-auto flex items-center gap-2 pr-4 lg:pr-6">
          <PendingRefundIndicator userId={userId} />
          {showBranchSwitcher && <PosBranchSwitcher />}
        </div>
      </div>
      <PosSubNav canConfigurePos={canConfigurePos} visibleHrefs={visibleTabHrefs} />
    </div>
  )
}
