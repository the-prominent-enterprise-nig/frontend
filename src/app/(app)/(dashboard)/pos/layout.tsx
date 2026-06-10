import ModuleGuard from '@/src/components/guards/ModuleGuard'
import { PosNav } from './_components/PosNav'

export const metadata = {
  title: 'Point of Sale - Prominent Enterprise',
  description: 'Point of Sale operations',
}

export default function PosLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModuleGuard module="pos">
      <div className="flex h-full flex-col">
        <PosNav />
        <div className="flex-1 overflow-auto">{children}</div>
      </div>
    </ModuleGuard>
  )
}
