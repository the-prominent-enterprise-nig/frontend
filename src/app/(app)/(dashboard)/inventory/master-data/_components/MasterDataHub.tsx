'use client'

import { useSearchParams } from 'next/navigation'
import { Settings, Warehouse, Wrench, type LucideIcon } from 'lucide-react'
import { TabNav, type NavTab } from '@/src/components/ui/TabNav'
import { can, type SessionUser } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { SUPPLIER_ACCESS } from '@/src/libs/guards/shared-ownership'
import { WarehouseList } from '../../warehouses/_components'
import { CostingConfigForm } from '../../settings/_components'
import { ServiceCenterList } from '../../service-centers/_components/ServiceCenterList'
import { PAGE_INNER, PAGE_SHELL } from './masterDataChrome'

type MasterDataTab = NavTab & { icon: LucideIcon; permissions: string[] }

const TABS: MasterDataTab[] = [
  {
    id: 'warehouses',
    label: 'Warehouses',
    icon: Warehouse,
    permissions: [INVENTORY_PERMISSIONS.WAREHOUSES_READ],
  },
  {
    id: 'service-centers',
    label: 'Service Centers',
    icon: Wrench,
    permissions: SUPPLIER_ACCESS.READ,
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    permissions: [
      INVENTORY_PERMISSIONS.COSTING_READ,
      INVENTORY_PERMISSIONS.COSTING_CONFIGURE,
      INVENTORY_PERMISSIONS.WILDCARD,
    ],
  },
]

function TabBody({ id, session }: { id: string; session: SessionUser }) {
  switch (id) {
    case 'warehouses':
      return <WarehouseList session={session} />
    case 'service-centers':
      return <ServiceCenterList session={session} />
    case 'settings':
      return (
        <div className={PAGE_SHELL}>
          <div className={PAGE_INNER}>
            <h1 className="text-[21px] font-semibold tracking-[-0.015em]">Settings</h1>
            <CostingConfigForm session={session} />
          </div>
        </div>
      )
    default:
      return null
  }
}

export function MasterDataHub({ session }: { session: SessionUser }) {
  const searchParams = useSearchParams()
  const visible = TABS.filter((tab) => tab.permissions.some((p) => can(session, p)))
  const requested = searchParams.get('tab')
  const active = visible.find((tab) => tab.id === requested) ?? visible[0]

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <TabNav tabs={visible} />
      {active && <TabBody id={active.id} session={session} />}
    </div>
  )
}
