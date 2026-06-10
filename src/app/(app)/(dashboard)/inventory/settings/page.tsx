import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can, canAny } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { CostingConfigForm } from './_components'

export const metadata = {
  title: 'Inventory Settings | Prominent Enterprise',
  description: 'Manage inventory settings and configurations',
}

export default async function InventorySettingsPage() {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  const canViewCosting = canAny(session, [
    INVENTORY_PERMISSIONS.COSTING_READ,
    INVENTORY_PERMISSIONS.COSTING_CONFIGURE,
  ])

  if (!canViewCosting && !can(session, INVENTORY_PERMISSIONS.WILDCARD)) {
    redirect('/403')
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-3xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 md:text-3xl">Inventory Settings</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Configure inventory-wide preferences and costing methods.
          </p>
        </div>

        {canViewCosting && (
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <CostingConfigForm session={session} />
          </div>
        )}
      </div>
    </div>
  )
}
