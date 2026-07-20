'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Settings,
  CreditCard,
  Monitor,
  Palette,
  HandCoins,
  LayoutList,
  Tv2,
  type LucideIcon,
} from 'lucide-react'

type TabItem = { label: string; href: string; icon: LucideIcon }
type TabGroup = { items: TabItem[] }

const GROUPS: TabGroup[] = [
  {
    items: [
      { label: 'General', href: '/pos/settings/general', icon: Settings },
      { label: 'Payment Methods', href: '/pos/settings/payment-methods', icon: CreditCard },
      { label: 'Terminals', href: '/pos/settings/terminals', icon: Monitor },
      { label: 'Receipt Branding', href: '/pos/settings/receipt-branding', icon: Palette },
    ],
  },
  {
    items: [
      { label: 'Financing Terms', href: '/pos/settings/financing-terms', icon: HandCoins },
      { label: 'Queue Categories', href: '/pos/settings/queue-categories', icon: LayoutList },
      { label: 'Customer Display', href: '/pos/settings/customer-display', icon: Tv2 },
    ],
  },
]

export function PosSettingsTabs() {
  const pathname = usePathname()
  return (
    <nav
      aria-label="POS settings tabs"
      className="w-56 shrink-0 border-r border-gray-200 bg-white px-3 py-5"
    >
      {GROUPS.map((group, i) => (
        <div key={i} className={i > 0 ? 'mt-4 border-t border-gray-100 pt-4' : ''}>
          {group.items.map(({ label, href, icon: Icon }) => {
            const active = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active ? 'bg-purple-50 text-purple-700' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Icon size={15} />
                {label}
              </Link>
            )
          })}
        </div>
      ))}
    </nav>
  )
}
