'use client'

import {
  ArrowLeftRight,
  Banknote,
  BookOpen,
  Car,
  Coins,
  HandCoins,
  IdCard,
  Key,
  Landmark,
  Library,
  PackageCheck,
  PhilippinePeso,
  Receipt,
  ReceiptText,
  Repeat,
  Scale,
  Truck,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { TabNav } from '@/src/components/ui/TabNav'
import type { SessionUser } from '@/src/libs/guards/permission'
import { HUBS, visibleHubTabs, type HubKey, type HubTabId } from './hubs'

const ICONS: Record<HubTabId, LucideIcon> = {
  'journal-entries': ReceiptText,
  'general-ledger': Library,
  'chart-of-accounts': BookOpen,
  'account-mapping': Key,
  'ar-invoices': Receipt,
  customers: Users,
  expenses: Coins,
  'recurring-expenses': Repeat,
  'special-accounts': Wallet,
  'employee-cash-loans': HandCoins,
  drivers: IdCard,
  vehicles: Car,
  'bank-accounts': Landmark,
  'undeposited-funds': Banknote,
  'inter-account-transfer': ArrowLeftRight,
  'bank-reconciliation': Scale,
  'ap-invoices': ReceiptText,
  'ap-payments': PhilippinePeso,
  'receiving-reports': PackageCheck,
  suppliers: Truck,
}

/**
 * Tab strip for an Accounting hub, rendered at the top of each of that hub's
 * list pages. Takes the hub's key rather than the hub itself because the icons
 * are components and cannot cross from a server page. Must sit inside a
 * <Suspense> boundary (TabNav reads searchParams).
 */
export function HubTabs({ hub, session }: { hub: HubKey; session: SessionUser }) {
  const tabs = visibleHubTabs(HUBS[hub], session).map((tab) => ({
    id: tab.id,
    label: tab.label,
    href: tab.href,
    icon: ICONS[tab.id as HubTabId],
  }))
  if (tabs.length === 0) return null
  return <TabNav tabs={tabs} />
}
