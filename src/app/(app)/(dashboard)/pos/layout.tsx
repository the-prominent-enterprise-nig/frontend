import ModuleGuard from '@/src/components/guards/ModuleGuard'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { canManagePosSettings } from '@/src/libs/guards/permission'
import { PosTopBar } from './_components/PosTopBar'

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
        <PosTopBar canConfigurePos={canConfigurePos} userId={userId} />
        <div className="flex-1 overflow-auto">{children}</div>
      </div>
    </ModuleGuard>
  )
}
