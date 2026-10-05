'use client'

import { useEffect } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeftRight,
  ClipboardCheck,
  ClipboardList,
  ClipboardX,
  PackageCheck,
  PackageX,
  ShieldCheck,
  ShoppingCart,
  Undo2,
  type LucideIcon,
} from 'lucide-react'
import { TabNav, type NavTab } from '@/src/components/ui/TabNav'
import { can, type SessionUser } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { PROCUREMENT_PERMISSIONS } from '@/src/libs/guards/procurement-permissions'
import type { ProcurementHubPermissions } from '../../purchase-orders/_permissions/procurement-hub-permissions'
import { PurchaseOrderList } from '../../purchase-orders/_components/PurchaseOrderList'
import { PurchaseRequestList } from '../../purchase-requests/_components/PurchaseRequestList'
import ReceivingReportsTab from '../../goods-receiving/_components/ReceivingReportsTab'
import { TransferList } from '../../transfers/_components'
import { ReturnList } from '../../returns/_components'
import { QualityHoldList } from '../../quality-hold/_components'
import { BackordersPageView } from '../../backorders/_components'
import { AdjustmentList } from '../../adjustments/_components'
import DebitMemoList from '../../debit-memos/_components/DebitMemoList'
import UdsList from '../../uds/_components/UdsList'

type TransactionTab = NavTab & { icon: LucideIcon; permissions: string[]; hidden?: boolean }

// Quality Hold, Backorders and Stock Adjustments are hidden from the hub for
// now. Their components and routes are untouched; set hidden to false to show
// them again.

const TABS: TransactionTab[] = [
  {
    id: 'receiving',
    label: 'Receiving Report',
    icon: PackageCheck,
    permissions: [INVENTORY_PERMISSIONS.RECEIVE_READ],
  },
  {
    id: 'transfers',
    label: 'Stock Transfer',
    icon: ArrowLeftRight,
    permissions: [INVENTORY_PERMISSIONS.TRANSFERS_READ],
  },
  {
    id: 'purchase-orders',
    label: 'Purchase Order',
    icon: ShoppingCart,
    permissions: [PROCUREMENT_PERMISSIONS.PO_READ, PROCUREMENT_PERMISSIONS.PR_READ],
  },
  {
    id: 'stock-requests',
    label: 'Stock Request',
    icon: ClipboardList,
    permissions: [PROCUREMENT_PERMISSIONS.PR_READ],
  },
  {
    id: 'debit-memos',
    label: 'Debit Memos',
    icon: PackageX,
    permissions: [INVENTORY_PERMISSIONS.SUPPLIER_RETURNS_READ],
  },
  {
    id: 'returns',
    label: 'Returns',
    icon: Undo2,
    permissions: [INVENTORY_PERMISSIONS.RETURNS_READ],
  },
  {
    id: 'quality',
    label: 'Quality Hold',
    icon: ShieldCheck,
    permissions: [INVENTORY_PERMISSIONS.QUALITY_HOLD_READ],
    hidden: true,
  },
  {
    id: 'backorders',
    label: 'Backorders',
    icon: ClipboardX,
    permissions: [INVENTORY_PERMISSIONS.BACKORDERS_READ],
    hidden: true,
  },
  {
    id: 'adjustments',
    label: 'Stock Adjustments',
    icon: ClipboardList,
    permissions: [
      INVENTORY_PERMISSIONS.STOCK_ADJUST,
      INVENTORY_PERMISSIONS.STOCK_ADJUSTMENT_CONFIRM,
      INVENTORY_PERMISSIONS.STOCK_ADJUSTMENT_INVESTIGATE,
      INVENTORY_PERMISSIONS.STOCK_ADJUSTMENT_APPROVE,
    ],
    hidden: true,
  },
  {
    id: 'uds',
    label: 'Unit Documents',
    icon: ClipboardCheck,
    permissions: [INVENTORY_PERMISSIONS.UDS_READ],
  },
]

function TabBody({
  id,
  session,
  procurement,
}: {
  id: string
  session: SessionUser
  procurement: ProcurementHubPermissions
}) {
  switch (id) {
    case 'receiving':
      return (
        <div className="mx-auto w-full max-w-[1560px] p-[14px] min-[1080px]:px-5 min-[1080px]:py-[22px]">
          <ReceivingReportsTab />
        </div>
      )
    case 'transfers':
      return <TransferList session={session} />
    case 'returns':
      return <ReturnList session={session} />
    case 'quality':
      return <QualityHoldList session={session} />
    case 'backorders':
      return <BackordersPageView session={session} />
    case 'adjustments':
      return <AdjustmentList session={session} />
    case 'purchase-orders':
      return (
        <PurchaseOrderList
          canCreate={procurement.canCreate}
          canApprove={procurement.canApprove}
          canSend={procurement.canSend}
          canCancel={procurement.canCancel}
          canClose={procurement.canClose}
          canEdit={procurement.canEdit}
          canReceive={procurement.canReceive}
          canViewCost={procurement.canViewCost}
          canViewApBill={procurement.canViewApBill}
          currentUserBranchId={session.branchId}
        />
      )
    case 'stock-requests':
      return <PurchaseRequestList session={session} />
    case 'debit-memos':
      return <DebitMemoList session={session} />
    case 'uds':
      return <UdsList session={session} />
    default:
      return null
  }
}

export function StockTransactionHub({
  session,
  procurement,
}: {
  session: SessionUser
  procurement: ProcurementHubPermissions
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const visible = TABS.filter((tab) => !tab.hidden && tab.permissions.some((p) => can(session, p)))
  const requested = searchParams.get('tab')
  const active = visible.find((tab) => tab.id === requested) ?? visible[0]

  // A hidden or inaccessible ?tab= would show content with no tab highlighted,
  // so rewrite the URL to the tab that is actually shown.
  useEffect(() => {
    if (active && requested !== active.id) {
      router.replace(`${pathname}?tab=${active.id}`)
    }
  }, [active, requested, pathname, router])

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <TabNav tabs={visible} />
      {active && <TabBody id={active.id} session={session} procurement={procurement} />}
    </div>
  )
}
