'use client'

import { useSearchParams } from 'next/navigation'
import { TabNav, type NavTab } from '@/src/components/ui/TabNav'
import { can, type SessionUser } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { WarehouseList } from '../../../inventory/warehouses/_components'
import type { BranchDetail } from '../../_actions/get-branches'
import BranchesSection from './BranchesSection'

type BranchesTab = NavTab & { permission?: string }

// Warehouses used to sit in Inventory → Master Data. They belong beside the
// branches: a branch's stock is kept against its own warehouse record, and the
// two real warehouses (Panay, Negros) are managed here too.
const TABS: BranchesTab[] = [
  { id: 'branches', label: 'Branches' },
  { id: 'warehouses', label: 'Warehouses', permission: INVENTORY_PERMISSIONS.WAREHOUSES_READ },
]

type Props = {
  session: SessionUser
  initialBranches: BranchDetail[]
  /** admin:branches:manage, which every branch write checks on the backend. */
  canManageBranches: boolean
}

export function BranchesHub({ session, initialBranches, canManageBranches }: Props) {
  const searchParams = useSearchParams()
  const visible = TABS.filter((tab) => !tab.permission || can(session, tab.permission))
  const requested = searchParams.get('tab')
  const active = visible.find((tab) => tab.id === requested) ?? visible[0]

  return (
    <div className="flex min-h-full flex-col bg-zinc-50">
      <TabNav tabs={visible} />
      {active.id === 'warehouses' ? (
        <WarehouseList session={session} />
      ) : (
        <div className="px-6 py-6">
          <div className="mx-auto max-w-7xl">
            <BranchesSection
              initialBranches={initialBranches}
              canManageBranches={canManageBranches}
            />
          </div>
        </div>
      )}
    </div>
  )
}
