'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  ShoppingCart,
  BookmarkCheck,
  ReceiptText,
  Clock,
  Wallet,
  Tag,
  Gift,
  Star,
  GitBranch,
  type LucideIcon,
} from 'lucide-react'

type NavItem = {
  label: string
  href: string
  exact?: boolean
  icon: LucideIcon
  /** Business Owner / Branch Manager only — hidden from everyone else (e.g. Cashier). */
  configOnly?: boolean
}

const GROUPS: { label: string; paths: string[]; items: NavItem[] }[] = [
  {
    label: 'Operations',
    // Parked Sales tab hidden for now (still a real, working feature — the
    // route/controller/service are untouched, and Scenario 09 still depends
    // on ParkedSalesService as-is — just no nav entry into it at the moment).
    paths: ['/pos', '/pos/checkout', '/pos/reservations', '/pos/transactions'],
    items: [
      { label: 'Overview', href: '/pos', exact: true, icon: LayoutDashboard },
      { label: 'Checkout', href: '/pos/checkout', icon: ShoppingCart },
      { label: 'Reservations', href: '/pos/reservations', icon: BookmarkCheck },
      { label: 'Transactions', href: '/pos/transactions', icon: ReceiptText },
    ] satisfies NavItem[],
  },
  {
    label: 'Management',
    paths: ['/pos/sessions', '/pos/cash-drawer'],
    items: [
      { label: 'Sessions', href: '/pos/sessions', icon: Clock },
      { label: 'Cash Drawer', href: '/pos/cash-drawer', icon: Wallet },
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
  // No "Configuration" group: /pos/settings/* has its own left-rail tabs
  // (PosSettingsTabs) and the Sidebar already highlights "Configuration" as
  // active there — a single-item PosNav tab bar with nothing else to switch
  // to had no navigational purpose, so these routes intentionally match no
  // group here and PosNav renders nothing, same as /pos/pin below.
]

/** Whether `pathname` belongs to one of PosNav's own tab groups — used by
 * PosTopBar to decide whether the shared branch switcher belongs in this bar
 * at all, since a page with no PosNav tabs usually surfaces it elsewhere
 * (e.g. inline with its own page title) or doesn't need it. */
export function isPosNavRoute(pathname: string): boolean {
  return GROUPS.some((g) => g.paths.includes(pathname))
}

export function PosNav({ canConfigurePos }: { canConfigurePos: boolean }) {
  const pathname = usePathname()

  // Standalone pages (approvals, void/refund requests, cancellation
  // requests, payment methods, receipt branding, customer display, etc.)
  // aren't part of any group — they used to silently fall back to the
  // Operations tabs (Overview/Checkout/Parked Sales/Transactions), which
  // don't apply there. Show nothing instead.
  const activeGroup = GROUPS.find((g) => g.paths.includes(pathname))
  if (!activeGroup) return null

  const visibleItems = activeGroup.items.filter((item) => canConfigurePos || !item.configOnly)

  return (
    <nav
      aria-label="POS section tabs"
      className="flex min-w-0 flex-1 items-center overflow-x-auto bg-white px-4 lg:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {visibleItems.map((item) => {
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
