'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const GROUPS = [
  {
    label: 'Operations',
    paths: ['/pos', '/pos/checkout', '/pos/order-queue', '/pos/parked-sales', '/pos/transactions'],
    items: [
      { label: 'Overview', href: '/pos', exact: true },
      { label: 'Checkout', href: '/pos/checkout' },
      { label: 'Order Queue', href: '/pos/order-queue' },
      { label: 'Parked Sales', href: '/pos/parked-sales' },
      { label: 'Transactions', href: '/pos/transactions' },
    ],
  },
  {
    label: 'Management',
    paths: ['/pos/sessions', '/pos/cash-drawer', '/pos/terminals', '/pos/menu-items'],
    items: [
      { label: 'Sessions', href: '/pos/sessions' },
      { label: 'Cash Drawer', href: '/pos/cash-drawer' },
      { label: 'Terminals', href: '/pos/terminals' },
      { label: 'Menu Items', href: '/pos/menu-items' },
    ],
  },
  {
    label: 'Promotions',
    paths: ['/pos/promo-codes', '/pos/gift-cards', '/pos/loyalty', '/pos/branch-pricing'],
    items: [
      { label: 'Promo Codes', href: '/pos/promo-codes' },
      { label: 'Gift Cards', href: '/pos/gift-cards' },
      { label: 'Loyalty', href: '/pos/loyalty' },
      { label: 'Branch Pricing', href: '/pos/branch-pricing' },
    ],
  },
  {
    label: 'Configuration',
    paths: ['/pos/gl-mapping', '/pos/pin', '/pos/settings', '/pos/config', '/pos/queue-categories'],
    items: [
      { label: 'GL Mapping', href: '/pos/gl-mapping' },
      { label: 'Cashier PIN', href: '/pos/pin' },
      { label: 'Queue Categories', href: '/pos/queue-categories' },
      { label: 'Settings', href: '/pos/settings' },
    ],
  },
]

export function PosNav() {
  const pathname = usePathname()

  const activeGroup = GROUPS.find((g) => g.paths.includes(pathname)) ?? GROUPS[0]

  return (
    <nav className="flex items-center overflow-x-auto border-b border-gray-200 bg-white px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden shrink-0">
      {activeGroup.items.map(({ label, href, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={`shrink-0 border-b-2 px-3.5 py-3 text-xs font-medium whitespace-nowrap transition-colors ${
              active
                ? 'border-purple-600 text-purple-700'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-800'
            }`}
          >
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
