import ModuleGuard from '@/src/components/guards/ModuleGuard'
import { PosNav } from './_components/PosNav'
import { PosBranchSwitcher } from './_components/PosBranchSwitcher'
import { PendingRfdIndicator } from './_components/PendingRfdIndicator'

export const metadata = {
  title: 'Point of Sale - Prominent Enterprise',
  description: 'Point of Sale operations',
}

export default function PosLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModuleGuard module="pos">
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-gray-100">
          <PosNav />
          <div className="flex items-center gap-2 pr-4 lg:pr-6">
            <PendingRfdIndicator />
            <PosBranchSwitcher />
          </div>
        </div>
        <div className="flex-1 overflow-auto">{children}</div>
      </div>
    </ModuleGuard>
  )
}
