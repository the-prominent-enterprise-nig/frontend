'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  ShoppingCart,
  ClipboardList,
  PauseCircle,
  ReceiptText,
  Clock,
  Wallet,
  Monitor,
  UtensilsCrossed,
  Tag,
  Gift,
  Star,
  GitBranch,
  BookOpen,
  KeyRound,
  LayoutList,
  Settings,
  type LucideIcon,
} from 'lucide-react'

type NavItem = { label: string; href: string; exact?: boolean; icon: LucideIcon }

const GROUPS = [
  {
    label: 'Operations',
    paths: ['/pos', '/pos/checkout', '/pos/order-queue', '/pos/parked-sales', '/pos/transactions'],
    items: [
      { label: 'Overview', href: '/pos', exact: true, icon: LayoutDashboard },
      { label: 'Checkout', href: '/pos/checkout', icon: ShoppingCart },
      { label: 'Order Queue', href: '/pos/order-queue', icon: ClipboardList },
      { label: 'Parked Sales', href: '/pos/parked-sales', icon: PauseCircle },
      { label: 'Transactions', href: '/pos/transactions', icon: ReceiptText },
    ] satisfies NavItem[],
  },
  {
    label: 'Management',
    paths: ['/pos/sessions', '/pos/cash-drawer', '/pos/terminals', '/pos/menu-items'],
    items: [
      { label: 'Sessions', href: '/pos/sessions', icon: Clock },
      { label: 'Cash Drawer', href: '/pos/cash-drawer', icon: Wallet },
      { label: 'Terminals', href: '/pos/terminals', icon: Monitor },
      { label: 'Menu Items', href: '/pos/menu-items', icon: UtensilsCrossed },
    ] satisfies NavItem[],
  },
  {
    label: 'Promotions',
    paths: ['/pos/promo-codes', '/pos/gift-cards', '/pos/loyalty', '/pos/branch-pricing'],
    items: [
      { label: 'Promo Codes', href: '/pos/promo-codes', icon: Tag },
      { label: 'Gift Cards', href: '/pos/gift-cards', icon: Gift },
      { label: 'Loyalty', href: '/pos/loyalty', icon: Star },
      { label: 'Branch Pricing', href: '/pos/branch-pricing', icon: GitBranch },
    ] satisfies NavItem[],
  },
  {
    label: 'Configuration',
    paths: ['/pos/gl-mapping', '/pos/pin', '/pos/settings', '/pos/config', '/pos/queue-categories'],
    items: [
      { label: 'GL Mapping', href: '/pos/gl-mapping', icon: BookOpen },
      { label: 'Cashier PIN', href: '/pos/pin', icon: KeyRound },
      { label: 'Queue Categories', href: '/pos/queue-categories', icon: LayoutList },
      { label: 'Settings', href: '/pos/settings', icon: Settings },
    ] satisfies NavItem[],
  },
]

export function PosNav() {
  const pathname = usePathname()

  const activeGroup = GROUPS.find((g) => g.paths.includes(pathname)) ?? GROUPS[0]

  return (
    <nav className="flex min-w-0 flex-1 items-center overflow-x-auto bg-white px-4 lg:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {activeGroup.items.map((item) => {
        const { label, href, exact } = item
        const active = exact ? pathname === href : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-3 text-[13px] font-medium whitespace-nowrap transition-colors md:px-4 ${
              active
                ? 'border-purple-600 text-purple-700'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-800'
            }`}
          >
            {item.icon && <item.icon className="h-3.5 w-3.5" />}
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
