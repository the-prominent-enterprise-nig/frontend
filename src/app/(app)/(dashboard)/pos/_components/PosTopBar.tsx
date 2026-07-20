'use client'

import { usePathname } from 'next/navigation'
import { PosNav, isPosNavRoute } from './PosNav'
import { PosBranchSwitcher } from './PosBranchSwitcher'
import { PendingRefundIndicator } from './PendingRefundIndicator'

export function PosTopBar({
  canConfigurePos,
  userId,
}: {
  canConfigurePos: boolean
  userId: string | null
}) {
  const pathname = usePathname()

  // The branch switcher only belongs in this shared bar for routes PosNav
  // itself has tabs for. Routes without a PosNav group (e.g. /pos/settings/*)
  // either surface it inline with their own page title instead, or — like
  // /pos/pin, which is pure per-user PIN self-service with nothing
  // branch-scoped on the page — don't need it at all.
  const showBranchSwitcher = isPosNavRoute(pathname)

  return (
    <div className="flex items-center justify-between border-b border-gray-100">
      <PosNav canConfigurePos={canConfigurePos} />
      <div className="flex items-center gap-2 pr-4 lg:pr-6">
        <PendingRefundIndicator userId={userId} />
        {showBranchSwitcher && <PosBranchSwitcher />}
      </div>
    </div>
  )
}
