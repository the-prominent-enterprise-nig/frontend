import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { canManagePosSettings } from '@/src/libs/guards/permission'
import { PosSettingsTabs } from './_components/PosSettingsTabs'
import { PosBranchSwitcher } from '../_components/PosBranchSwitcher'

export default async function PosSettingsLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!canManagePosSettings(session)) redirect('/403')

  return (
    <div className="min-h-full bg-zinc-50">
      <div className="flex items-start justify-between gap-4 border-b border-gray-200 bg-white px-6 py-5">
        <div>
          <h1 className="text-2xl font-bold text-prominent-purple-900">POS Settings</h1>
          <p className="mt-1 text-sm text-gray-500">
            Terminals, pricing rules, payment routing, and other POS-wide settings.
          </p>
        </div>
        <PosBranchSwitcher />
      </div>
      <div className="flex">
        <PosSettingsTabs />
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  )
}
