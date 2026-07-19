import ModuleGuard from '@/src/components/guards/ModuleGuard'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { canManagePosSettings } from '@/src/libs/guards/permission'
import { PosNav } from './_components/PosNav'
import { PosBranchSwitcher } from './_components/PosBranchSwitcher'
import { PendingRefundIndicator } from './_components/PendingRefundIndicator'

export const metadata = {
  title: 'Point of Sale - Prominent Enterprise',
  description: 'Point of Sale operations',
}

export default async function PosLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionOrNull()
  const userId = session?.id ?? null
  const canConfigurePos = session ? canManagePosSettings(session) : false

  return (
    <ModuleGuard module="pos">
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-gray-100">
          <PosNav canConfigurePos={canConfigurePos} />
          <div className="flex items-center gap-2 pr-4 lg:pr-6">
            <PendingRefundIndicator userId={userId} />
            <PosBranchSwitcher />
          </div>
        </div>
        <div className="flex-1 overflow-auto">{children}</div>
      </div>
    </ModuleGuard>
  )
}
