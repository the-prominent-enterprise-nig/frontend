'use client'

import { useSearchParams } from 'next/navigation'
import { Settings, Tags, Truck, Warehouse, type LucideIcon } from 'lucide-react'
import { TabNav, type NavTab } from '@/src/components/ui/TabNav'
import { can, type SessionUser } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { PROCUREMENT_PERMISSIONS } from '@/src/libs/guards/procurement-permissions'
import { WarehouseList } from '../../warehouses/_components'
import SupplierDirectory from '../../suppliers/_components/SupplierDirectory'
import { PriceListsPageView } from '../../price-lists/_components'
import { CostingConfigForm } from '../../settings/_components'

type MasterDataTab = NavTab & { icon: LucideIcon; permissions: string[] }

const TABS: MasterDataTab[] = [
  {
    id: 'warehouses',
    label: 'Warehouses',
    icon: Warehouse,
    permissions: [INVENTORY_PERMISSIONS.WAREHOUSES_READ],
  },
  {
    id: 'suppliers',
    label: 'Suppliers',
    icon: Truck,
    permissions: [PROCUREMENT_PERMISSIONS.SUPPLIERS_READ],
  },
  {
    id: 'price-lists',
    label: 'Price Lists',
    icon: Tags,
    permissions: [INVENTORY_PERMISSIONS.PRICE_LISTS_READ],
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
    case 'suppliers':
      return <SupplierDirectory session={session} />
    case 'price-lists':
      return <PriceListsPageView session={session} />
    case 'settings':
      return (
        <div className="mx-auto w-full max-w-[1560px] p-[14px] min-[1080px]:px-5 min-[1080px]:py-[22px]">
          <h1 className="mb-[14px] text-[21px] font-semibold tracking-[-0.015em]">Settings</h1>
          <CostingConfigForm session={session} />
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
