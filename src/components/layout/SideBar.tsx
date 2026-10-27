'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { getPendingInviteCount } from '@/src/app/(app)/(dashboard)/settings/_actions/get-pending-invite-count'
import { hasExactPermission, hasModuleAccess, hasPermission } from '@/src/hooks/usePermission'
import { MODULES } from '@/src/libs/guards/modules'
import { CRM_PERMISSIONS } from '@/src/libs/guards/crm-permissions'
import { REMINDERS_ENABLED } from '@/src/libs/features'
import {
  ArrowLeftRight,
  BarChart3,
  BellRing,
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  ClipboardList,
  Coins,
  Contact,
  FileBarChart,
  Database,
  FilePlus,
  HandCoins,
  House,
  IdCard,
  Landmark,
  Layers,
  MoreHorizontal,
  Package,
  Receipt,
  PhilippinePeso,
  ScrollText,
  Settings,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Tag,
  Undo2,
  UsersRound,
  UserPlus,
  Wallet,
  Warehouse,
  Network,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import {
  BOOKS_HUB,
  CASH_BANKING_HUB,
  EXPENSES_HUB,
  HUBS,
  PAYABLES_HUB,
  RECEIVABLES_HUB,
  type Hub,
} from '@/src/app/(app)/(dashboard)/accounting/_shared/hubs'
import { PROCUREMENT_PERMISSIONS } from '@/src/libs/guards/procurement-permissions'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import { POS_PERMISSIONS } from '@/src/libs/guards/pos-permissions'
import {
  APPROVALS_REVIEWS_HUB,
  CASH_RECEIPTS_HUB,
  CREDIT_COLLECTIONS_HUB,
  OPERATIONS_ADMIN_HUB,
  POS_HUBS,
  PRICING_PROMOTION_HUB,
  PRODUCT_CATALOG_HUB,
  REPORTS_HUB,
  SALES_COUNTER_HUB,
  posHubActiveHrefs,
  posTabPermissions,
  type PosHub,
} from '@/src/app/(app)/(dashboard)/pos/_shared/pos-hubs'
import SidebarSearch, { type SearchEntry } from './SidebarSearch'
import { usePosOverridePendingCount } from '@/src/app/(app)/(dashboard)/pos/_hooks/usePosOverridePendingCount'

type NavItem = {
  label: string
  href: string
  icon: LucideIcon
  requiredPermission?: string | string[]
  /**
   * For an item with no single requiredPermission that still needs some
   * gate — e.g. POS PIN, deliberately ungated on any specific pos:x:y
   * permission so hiding one narrow permission from a POS role doesn't
   * also remove their only way to set up their own PIN (see that item's
   * own comment). requiredPermission can't express "any permission in this
   * module" — a required 'pos:*' only matches a literal pos:* grant, not a
   * narrow pos:application:view — so this checks hasModuleAccess instead,
   * the same "any access to this module" test the top-level module list
   * itself uses. Without it, filterItem's `if (!requiredPermission) return
   * true` showed this item to every signed-in user regardless of module
   * access, including one with none at all — the link stayed visible, only
   * the /pos/pin route itself caught it with a 403.
   */
  requiresModuleAccess?: string
  /** Must hold this exact permission row — wildcards don't count. */
  exactPermission?: string
  badge?: { text: string; variant: 'count' | 'new'; color?: string }
  subItems?: Array<{
    label: string
    href: string
    icon: LucideIcon
    requiredPermission?: string | string[]
  }>
  /** Renders as an expand/collapse header instead of a link. The items it
   *  controls are ordinary entries placed directly after it. */
  collapsible?: { open: boolean; onToggle: () => void }
  section?: string
  activeWhen?: string[]
  usePrefix?: boolean
  /** Lit on any path equal to, or under, one of these — a hub whose tabs are separate routes. */
  activePrefixes?: string[]
  /**
   * Kept even though its href repeats a row already shown — the module row.
   * POS's Operations links to /pos like the "Point of Sale" module row does, and
   * is the only way the sale-flow tabs (Overview, Checkout, …) get a row of
   * their own.
   */
  keepBesideModuleRow?: boolean
}

type NavGroup = {
  label: string
  icon: LucideIcon
  items: NavItem[]
}

interface SessionUser {
  id: string
  employeeId?: string
  roles: string[]
  permissions: string[]
  primaryRole?: string
  moduleAccess?: string[]
  branchId?: string | null
}

type NavConfig = {
  main: NavItem[]
  groups?: NavGroup[]
  bottom: NavItem[]
}

const MODULE_ICON_MAP: Partial<Record<string, LucideIcon>> = {
  'chart-bar': BarChart3,
  package: Package,
  'shopping-cart': ShoppingCart,
  'users-round': UsersRound,
}

/**
 * One sidebar item for an Accounting hub. Visible when the user can open any of
 * its tabs, lit on every tab's route and everything under it, and linked to the
 * hub's entry route, which redirects to the first tab they can open.
 */
function hubNavItem(hub: Hub, label: string, icon: LucideIcon): NavItem {
  return {
    label,
    href: hub.entryHref,
    icon,
    // A tab with no permission requirement (Special Accounts) keeps the item
    // visible to anyone with accounting access, as that tab's own sidebar
    // item was — requiresModuleAccess, so it still disappears for someone
    // with no accounting access at all.
    requiredPermission: hub.tabs.some((tab) => tab.permissions.length === 0)
      ? undefined
      : hub.tabs.flatMap((tab) => tab.permissions),
    requiresModuleAccess: hub.tabs.some((tab) => tab.permissions.length === 0)
      ? 'accounting'
      : undefined,
    activePrefixes: hub.tabs.map((tab) => tab.href),
  }
}

/**
 * One sidebar item for a POS hub (pos/_shared/pos-hubs.ts), the way hubNavItem is
 * for Accounting. Visible when the user can open any of its tabs — or holds the
 * hub's own `permission`, where its tabs are ungated or its entry route is a real
 * page — and lit on the hub's routes.
 */
function posHubNavItem(hub: PosHub, label: string, icon: LucideIcon): NavItem {
  const ungated = !hub.permission && hub.tabs.some((tab) => posTabPermissions(tab).length === 0)
  const permissions = ungated
    ? []
    : (hub.permission ?? hub.tabs.flatMap((tab) => posTabPermissions(tab)))
  const { exact, prefix } = posHubActiveHrefs(hub)
  return {
    label,
    href: hub.entryHref,
    icon,
    requiredPermission: permissions.length ? permissions : undefined,
    requiresModuleAccess: permissions.length ? undefined : 'pos',
    ...(exact.length ? { activeWhen: exact } : {}),
    ...(prefix.length ? { activePrefixes: prefix } : {}),
  }
}

const navItemsBySegment: Record<string, NavConfig> = {
  'Business Owner': {
    main: [],
    bottom: [],
  },
  inventory: {
    main: [
      {
        label: 'Item Master',
        href: '/inventory/catalog',
        icon: Tag,
        requiredPermission: INVENTORY_PERMISSIONS.ITEMS_READ,
      },
      {
        label: 'Stock Ledger',
        href: '/inventory/stock',
        icon: BookOpen,
        requiredPermission: [INVENTORY_PERMISSIONS.STOCKS_READ, INVENTORY_PERMISSIONS.RECEIVE_READ],
      },
      {
        label: 'Stock Transaction',
        href: '/inventory/stock-transaction',
        icon: ArrowLeftRight,
        requiredPermission: [
          INVENTORY_PERMISSIONS.RECEIVE_READ,
          INVENTORY_PERMISSIONS.TRANSFERS_READ,
          INVENTORY_PERMISSIONS.RETURNS_READ,
          INVENTORY_PERMISSIONS.SUPPLIER_RETURNS_READ,
          INVENTORY_PERMISSIONS.UDS_READ,
          INVENTORY_PERMISSIONS.DELIVERY_RECEIPTS_READ,
          INVENTORY_PERMISSIONS.DELIVERY_RECEIPTS_CREATE,
          INVENTORY_PERMISSIONS.DELIVERY_RECEIPTS_APPROVE,
          PROCUREMENT_PERMISSIONS.PO_READ,
          PROCUREMENT_PERMISSIONS.PR_READ,
        ],
      },
      {
        label: 'Master Data',
        href: '/inventory/master-data',
        icon: Layers,
        requiredPermission: [
          INVENTORY_PERMISSIONS.WAREHOUSES_READ,
          INVENTORY_PERMISSIONS.COSTING_READ,
          INVENTORY_PERMISSIONS.COSTING_CONFIGURE,
          INVENTORY_PERMISSIONS.WILDCARD,
        ],
      },
      {
        label: 'Stock Report',
        href: '/inventory/reports',
        icon: FileBarChart,
        requiredPermission: INVENTORY_PERMISSIONS.REPORTS_VALUATION,
      },
      // Counting and Finance are hidden from the nav. Their routes still load:
      // /inventory/counting (Stock Adjustments is linked from Stock Transaction
      // above), /inventory/finance.
    ],
    bottom: [],
  },
  accounting: {
    // Grouped by workflow: books → receivables → payables → expenses/special
    // accounts → memos → banking → reporting. Books, receivables, payables,
    // expenses and banking are hubs (accounting/_shared/hubs.ts).
    main: [
      // Journal Entries, General Ledger, Chart of Accounts and Account Mapping are
      // the books themselves; AR Invoices and Customers are the receivables side.
      hubNavItem(BOOKS_HUB, 'Books', BookOpen),
      hubNavItem(RECEIVABLES_HUB, 'Receivables', Receipt),
      // AP Invoices, the Payments register (Scenario 46 Part F — everything that
      // left the bank) and Receiving Reports are one payables workflow, so they
      // are tabs of one hub rather than three items.
      hubNavItem(PAYABLES_HUB, 'Payables', PhilippinePeso),
      // Expenses (with its Recurring list), Special Accounts and Employee Cash Loans.
      // Employee Cash Loans issue against a Special Account ledger (Scenario 52).
      hubNavItem(EXPENSES_HUB, 'Expenses', Coins),
      // Two entries, not four. Credit and debit stay separate — that is the
      // split accounting actually thinks in — while customer and supplier
      // debit memos share one table, told apart by a Party column.
      {
        label: 'Credit Memos',
        href: '/accounting/credit-memos',
        icon: Undo2,
        requiredPermission: ACCOUNTING_PERMISSIONS.CREDIT_MEMOS_READ,
      },
      {
        label: 'Debit Memos',
        href: '/accounting/debit-memos',
        icon: FilePlus,
        usePrefix: true,
        requiredPermission: [
          ACCOUNTING_PERMISSIONS.DEBIT_MEMOS_READ,
          ACCOUNTING_PERMISSIONS.SUPPLIER_DEBIT_MEMOS_READ,
          ACCOUNTING_PERMISSIONS.INVENTORY_DEBIT_MEMOS_READ,
        ],
      },
      // Scenario 62 — Bank and Cash Accounts, Undeposited Funds, Inter-Account
      // Transfer and Bank Reconciliation are one workflow, so they are tabs of one
      // hub rather than four items. See hubNavItem and accounting/_shared/hubs.ts.
      hubNavItem(CASH_BANKING_HUB, 'Cash & Banking', Landmark),
      {
        label: 'Reports',
        href: '/accounting/reports',
        icon: FileBarChart,
        requiredPermission: ACCOUNTING_PERMISSIONS.FINANCIAL_REPORT_READ,
      },
      // Tax Codes, Tax Reports and Tax Closing are hidden from the nav (not on main yet).
      // Their routes still load: /accounting/tax-codes, /accounting/tax-reports,
      // /accounting/tax-closing.
      // Scenario 62 — raw data from every module, read-only. Business Owner
      // only; exact permission so the Accountant's accounting:* can't reach.
      {
        label: 'Data Query Center',
        href: '/accounting/query-center',
        icon: Database,
        exactPermission: ACCOUNTING_PERMISSIONS.QUERY_CENTER_READ,
      },
    ],
    bottom: [],
  },
  pos: {
    main: [
      // Overview, Checkout, Reservations, Transactions, Parked Sales — the sale
      // flow. Lit on those five routes only, unlike the module row above it,
      // which is lit on every /pos page. ShoppingBag, not the module row's cart.
      {
        ...posHubNavItem(SALES_COUNTER_HUB, 'Sales Counter', ShoppingBag),
        keepBesideModuleRow: true,
      },
      // Product Catalog | Price Lists. Not a sale, so not a Sales Counter tab (client
      // decision, against the revision doc), and Price Lists sits beside it rather than
      // under Operations & Admin: the catalog shows the prices the lists set. The row
      // shows when either is held. Entry route: /pos/product-catalog.
      posHubNavItem(PRODUCT_CATALOG_HUB, 'Product Catalog', BookOpen),
      // Collections | Credit Applications | Customers — the customer's account, in the
      // order the client wants (client decision, against the revision doc, which has
      // Credit Applications and Collections under Cash & Collections and drops
      // Customers). Each tab keeps its own permission; the row shows when any one
      // is held. Entry route: /pos/credit-collections.
      posHubNavItem(CREDIT_COLLECTIONS_HUB, 'Credit & Collections', HandCoins),
      // Promotions (Promo Codes | Gift Cards | Loyalty) and Price Maker. Entry
      // route: /pos/pricing-promotion.
      posHubNavItem(PRICING_PROMOTION_HUB, 'Pricing & Promotion', Tag),
      // Management (Sessions | Cash Drawer), New Receipts, Collected Funds History —
      // the till and the money taken at it. Each tab keeps its own permission; the
      // item shows when any one is held. Entry route: /pos/cash-receipts.
      posHubNavItem(CASH_RECEIPTS_HUB, 'Cash & Receipts', Wallet),
      // The manager queues. Each tab is gated like its page, so Cashier (read,
      // not override) gets Unit Release Approvals and Void Requests only. The
      // pending-override badge is attached in SideBar below (withBadge). Entry
      // route: /pos/approvals.
      posHubNavItem(APPROVALS_REVIEWS_HUB, 'Approvals & Reviews', ShieldCheck),
      // Sales Reports (Branch-Manager tier) and Daily Collection (the cashier's
      // end-of-day sheet). Entry route: /pos/reporting.
      posHubNavItem(REPORTS_HUB, 'Reports', BarChart3),
      // Service Jobs, POS PIN, Settings. The row shows for
      // any POS role (POS PIN needs no permission); each tab is gated on its
      // own. Entry route: /pos/admin.
      posHubNavItem(OPERATIONS_ADMIN_HUB, 'Operations & Admin', Wrench),
    ],
    bottom: [],
  },
  crm: {
    main: [
      {
        label: 'Customers',
        href: '/crm/customers',
        icon: Contact,
        requiredPermission: CRM_PERMISSIONS.CUSTOMERS_READ,
      },
      {
        label: 'CRM Dashboard',
        href: '/crm',
        icon: House,
        requiredPermission: CRM_PERMISSIONS.LEADS_READ,
      },
      {
        label: 'Collectors',
        href: '/crm/collectors',
        icon: HandCoins,
        requiredPermission: CRM_PERMISSIONS.COLLECTORS_READ,
      },
      {
        label: 'Installment Accounts',
        href: '/crm/installment-accounts',
        icon: Wallet,
        requiredPermission: CRM_PERMISSIONS.INSTALLMENT_ACCOUNTS_READ,
      },
      // Collection Incentives is hidden from the nav. Its route still loads:
      // /crm/collection-incentives.
      ...(REMINDERS_ENABLED
        ? [
            {
              label: 'Reminders',
              href: '/crm/reminders',
              icon: BellRing,
              requiredPermission: CRM_PERMISSIONS.REMINDERS_READ,
            },
          ]
        : []),
      {
        label: 'Segments',
        href: '/crm/segments',
        icon: Layers,
        requiredPermission: CRM_PERMISSIONS.SEGMENTS_READ,
      },
      {
        label: 'Sales Agents',
        href: '/crm/agents',
        icon: IdCard,
        requiredPermission: CRM_PERMISSIONS.AGENTS_READ,
      },
      {
        label: 'Settings',
        href: '/crm/settings',
        icon: Settings,
        // Matches the permission /crm/settings itself redirects on — without
        // this the item showed to anyone who could reach the crm module at
        // all (e.g. Cashier, added 2026-09-18 for Customers) and 403'd on
        // click.
        requiredPermission: CRM_PERMISSIONS.PIPELINE_MANAGE,
      },
    ],
    bottom: [],
  },
}

function NavLink({
  item,
  pathname,
  collapsed,
  onClick,
  isMobile = false,
}: {
  item: NavItem
  pathname: string
  collapsed: boolean
  onClick?: () => void
  isMobile?: boolean
}) {
  // activeWhen (exact paths) and activePrefixes (a path and everything under it)
  // can both be set; the row is lit by either.
  const isActive =
    item.activeWhen || item.activePrefixes
      ? !!item.activeWhen?.includes(pathname) ||
        !!item.activePrefixes?.some((p) => pathname === p || pathname.startsWith(p + '/'))
      : item.usePrefix
        ? pathname === item.href || pathname.startsWith(item.href + '/')
        : pathname === item.href
  return (
    <div className="relative group">
      <Link
        href={item.href}
        onClick={onClick}
        className={`flex items-center gap-2.5 rounded-lg transition-all duration-150 ${
          collapsed ? 'justify-center px-1.5 py-1.5' : 'px-2 py-1.5'
        } ${
          isActive
            ? 'bg-prominent-orange-200/20'
            : isMobile
              ? 'hover:bg-gray-100'
              : 'hover:bg-gray-100/20'
        }`}
      >
        {/* Icon */}
        <span className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg`}>
          <item.icon
            className={`h-6 w-6 ${isMobile ? (isActive ? 'text-prominent-orange-700' : 'text-gray-700') : 'text-white'}`}
          />
          {collapsed && item.badge?.variant === 'count' && (
            <span
              className={`absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border border-white ${item.badge.color}`}
            />
          )}
        </span>

        {!collapsed && (
          <div
            className={`flex flex-1 items-center gap-1.5 ${isMobile ? (isActive ? 'text-prominent-orange-700' : 'text-gray-800') : 'text-white'}`}
          >
            <span className={`flex-1 text-[13px] font-medium leading-tight`}>{item.label}</span>
            {item.badge &&
              (item.badge.variant === 'count' ? (
                <span
                  className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white ${item.badge.color}`}
                >
                  {item.badge.text}
                </span>
              ) : (
                <span className="rounded-full bg-prominent-purple-100 px-2 py-0.5 text-[10px] font-semibold text-prominent-purple-600">
                  {item.badge.text}
                </span>
              ))}
          </div>
        )}
      </Link>

      {/* Tooltip — collapsed only */}
      {collapsed && (
        <div className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          <div className="whitespace-nowrap rounded-lg bg-prominent-orange-700/95 px-2.5 py-1.5 text-[12.5px] font-medium text-white shadow-lg">
            {item.label}
          </div>
        </div>
      )}
    </div>
  )
}

function FlyoutPanel({
  item,
  pathname,
  onPick,
}: {
  item: NavItem
  pathname: string
  onPick: () => void
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl">
      <p className="border-b border-zinc-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
        {item.label}
      </p>
      {item.subItems?.map((sub) => {
        const subActive = pathname === sub.href
        return (
          <Link
            key={sub.href}
            href={sub.href}
            onClick={onPick}
            className={`flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium transition-colors ${
              subActive
                ? 'bg-prominent-orange-50 text-prominent-orange-700'
                : 'text-zinc-700 hover:bg-zinc-50'
            }`}
          >
            <sub.icon className="h-4 w-4 shrink-0" />
            {sub.label}
          </Link>
        )
      })}
    </div>
  )
}

function AdminSettingsDropdownItem({
  item,
  pathname,
  collapsed,
  onClick,
  isMobile = false,
}: {
  item: NavItem
  pathname: string
  collapsed: boolean
  onClick?: () => void
  isMobile?: boolean
}) {
  const isActive = item.subItems?.some((s) => pathname === s.href) ?? pathname === item.href
  const triggerRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null)

  // Click outside or Escape closes an open desktop panel.
  useEffect(() => {
    if (!anchor) return
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return
      setAnchor(null)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAnchor(null)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [anchor])

  // The sidebar's nav list scrolls, which clips anything absolutely positioned
  // inside it. Desktop panels therefore render in a portal at the trigger's
  // screen position; mobile keeps the in-place flyout.
  const togglePanel = () => {
    if (anchor) return setAnchor(null)
    const rect = triggerRef.current?.getBoundingClientRect()
    if (rect) setAnchor({ top: rect.top, left: rect.right })
  }
  const pickSubItem = () => {
    setAnchor(null)
    onClick?.()
  }

  return (
    <div className="relative group/dropdown">
      {/* Trigger — not a link, just a visual row */}
      <div
        ref={triggerRef}
        onClick={isMobile ? undefined : togglePanel}
        className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 transition-all duration-150 ${
          collapsed ? 'justify-center' : ''
        } ${isActive ? 'bg-prominent-orange-200/20' : isMobile ? 'hover:bg-gray-100' : ''}`}
      >
        <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg">
          <item.icon
            className={`h-4 w-4 ${isMobile ? (isActive ? 'text-prominent-orange-700' : 'text-gray-700') : 'text-white'}`}
          />
        </span>
        {!collapsed && !isMobile && (
          <span className="flex-1 text-[13px] font-medium text-white">{item.label}</span>
        )}
        {!collapsed && isMobile && (
          <>
            <span
              className={`flex-1 text-[13px] font-medium ${isActive ? 'text-prominent-orange-700' : 'text-gray-800'}`}
            >
              {item.label}
            </span>
            <ChevronUp className="h-3 w-3 text-gray-400" />
          </>
        )}
      </div>

      {isMobile && (
        <div className="pointer-events-none absolute z-50 bottom-full left-0 w-full pb-2 opacity-0 transition-all duration-150 group-hover/dropdown:pointer-events-auto group-hover/dropdown:opacity-100">
          <FlyoutPanel item={item} pathname={pathname} onPick={pickSubItem} />
        </div>
      )}

      {!isMobile &&
        anchor &&
        createPortal(
          <div
            ref={panelRef}
            style={{ top: anchor.top, left: anchor.left }}
            className="fixed z-[60] min-w-48 pl-3"
          >
            <FlyoutPanel item={item} pathname={pathname} onPick={pickSubItem} />
          </div>,
          document.body
        )}

      {/* Collapsed tooltip */}
      {collapsed && (
        <div className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 opacity-0 transition-opacity duration-150 group-hover/dropdown:opacity-0">
          <div className="whitespace-nowrap rounded-lg bg-prominent-orange-700/95 px-2.5 py-1.5 text-[12.5px] font-medium text-white shadow-lg">
            {item.label}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Expand/collapse header for an inline group. Deliberately not the
 * subItems flyout: that one opens *upward* (`bottom-full`), which reads fine
 * for a row sitting at the bottom of the sidebar but not for one near the top,
 * where it covers the nav above it. This expands in place instead.
 */
function CollapsibleGroupHeader({
  item,
  collapsed,
  isMobile = false,
}: {
  item: NavItem
  collapsed: boolean
  isMobile?: boolean
}) {
  const open = item.collapsible?.open ?? false
  return (
    <button
      type="button"
      onClick={item.collapsible?.onToggle}
      aria-expanded={open}
      className={`flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 transition-all duration-150 ${
        collapsed ? 'justify-center' : ''
      } ${isMobile ? 'hover:bg-gray-100' : 'hover:bg-gray-100/20'}`}
    >
      <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg">
        <item.icon className={`h-4 w-4 ${isMobile ? 'text-gray-700' : 'text-white'}`} />
      </span>
      {!collapsed && (
        <>
          <span
            className={`flex-1 text-left text-[13px] font-medium ${
              isMobile ? 'text-gray-800' : 'text-white'
            }`}
          >
            {item.label}
          </span>
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform duration-150 ${
              open ? '' : '-rotate-90'
            } ${isMobile ? 'text-gray-400' : 'text-white/50'}`}
          />
        </>
      )}
    </button>
  )
}

function NavItems({
  items,
  pathname,
  collapsed,
  onClick,
  isMobile = false,
}: {
  items: NavItem[]
  pathname: string
  collapsed: boolean
  onClick?: () => void
  isMobile?: boolean
}) {
  const { decorated } = items.reduce<{
    decorated: { item: NavItem; showSection: boolean }[]
    lastSection: string | undefined
  }>(
    (acc, item) => ({
      decorated: [
        ...acc.decorated,
        { item, showSection: !collapsed && !!item.section && item.section !== acc.lastSection },
      ],
      lastSection: item.section ?? acc.lastSection,
    }),
    { decorated: [], lastSection: undefined }
  )

  return (
    <>
      {decorated.map(({ item, showSection }) => (
        <div key={`${item.href}|${item.label}`}>
          {showSection && (
            <p
              className={`px-2 pb-1 pt-3 text-[10.5px] font-semibold uppercase tracking-wider ${
                isMobile ? 'text-zinc-400' : 'text-white/45'
              }`}
            >
              {item.section}
            </p>
          )}
          {item.collapsible ? (
            <CollapsibleGroupHeader item={item} collapsed={collapsed} isMobile={isMobile} />
          ) : item.subItems ? (
            <AdminSettingsDropdownItem
              item={item}
              pathname={pathname}
              collapsed={collapsed}
              onClick={onClick}
              isMobile={isMobile}
            />
          ) : (
            <NavLink
              item={item}
              pathname={pathname}
              collapsed={collapsed}
              onClick={onClick}
              isMobile={isMobile}
            />
          )}
        </div>
      ))}
    </>
  )
}

const DASHBOARD_ITEM: NavItem = { label: 'Dashboard', href: '/dashboard', icon: House }

// isAdmin() in src/libs/guards/permission.ts — the gate every /settings page
// actually runs — is roles:manage OR permissions:manage, plus a Business Owner
// name bypass that hasPermission reproduces on its own. Naming it here lets
// each entry below declare exactly what its own page checks, so the nav can
// never offer a link that redirects on arrival, nor hide one that would work.
const ADMIN_TIER = ['admin:roles:manage', 'admin:permissions:manage']

// Confirmed intended, not an oversight (#168 review, 2026-09-14): both of these
// are in access-levels.ts's PRESET_EXCLUDED_PERMISSIONS, so the Admin module's
// "Manage / Edit" button never grants either — that IS the fix from #168 (a role
// built via that button could otherwise mint a new role and grant it *:*). One
// consequence: a role assembled purely from module-level presets, with Admin set
// to Manage / Edit, sees Users below and nothing else here — Branches,
// Departments, Business Policies and Payment Methods all require full isAdmin
// and stay reachable only via Full Access on Admin, or by picking
// admin:roles:manage / admin:permissions:manage individually under Advanced
// permissions. Sharper module-level access needs the per-resource tier (#169)
// or a narrower page guard on those four routes — neither is this file's job.

// Every settings entry, for every role. Visibility comes from the permissions
// declared on each item (applied by filterItem below), not from a role name.
//
// This replaced a three-way split on role name: Business Owner got all of
// these, Branch Manager got its own one-item list, and everyone else got
// MY_WORKSPACE_ITEMS — an empty array. So any role not literally *named*
// "Business Owner" or "Branch Manager" had no settings nav at all, however it
// was granted. A custom role holding admin:users:read could open
// /settings/users and use it, but nothing in the app linked there.
const WORKSPACE_ITEMS: NavItem[] = [
  {
    section: 'My Workspace',
    label: 'Users',
    href: '/settings/users',
    icon: UsersRound,
    requiredPermission: [...ADMIN_TIER, 'admin:users:read'],
  },
  {
    section: 'My Workspace',
    label: 'Pending Invites',
    href: '/settings/pending-invites',
    icon: UserPlus,
    requiredPermission: [...ADMIN_TIER, 'admin:users:read'],
  },
  {
    // Business-Owner-level master list — also the source of the
    // employee-cash-loan borrower picker and the "Create Customer"
    // quick-link on its own detail page (accounting/employees).
    section: 'My Workspace',
    label: 'Employees',
    href: '/accounting/employees',
    icon: IdCard,
    requiredPermission: ACCOUNTING_PERMISSIONS.EMPLOYEE_READ,
    usePrefix: true,
  },
  {
    section: 'My Workspace',
    label: 'Roles & Access',
    href: '/settings/roles',
    icon: ShieldCheck,
    requiredPermission: ADMIN_TIER,
  },
  {
    section: 'My Workspace',
    label: 'Branches',
    href: '/settings/branches',
    icon: Warehouse,
    requiredPermission: ADMIN_TIER,
  },
  {
    section: 'My Workspace',
    label: 'Departments',
    href: '/settings/departments',
    icon: Network,
    requiredPermission: ADMIN_TIER,
  },
  {
    section: 'My Workspace',
    label: 'Business Policies',
    href: '/settings/business-policies',
    icon: ScrollText,
    requiredPermission: ADMIN_TIER,
  },
  {
    section: 'My Workspace',
    label: 'Payment Methods',
    href: '/settings/payment-methods',
    icon: Wallet,
    requiredPermission: ADMIN_TIER,
  },
  {
    section: 'My Workspace',
    label: 'Audit Logs',
    href: '/settings/audit-logs',
    icon: ClipboardList,
    // Not ADMIN_TIER: the page itself admits isAdmin, but the audit-log API
    // behind it requires admin:audit-logs:read and nothing else, so an
    // admin-tier role without that row would land on a page that can't load.
    requiredPermission: 'admin:audit-logs:read',
  },
]

function branchManagerWorkspaceItems(branchId?: string | null): NavItem[] {
  return branchId
    ? [
        {
          section: 'My Workspace' as const,
          label: 'My Branch',
          href: `/settings/branches/${branchId}`,
          icon: Warehouse,
        },
      ]
    : []
}

const MODULE_SECTION_LABELS: Record<string, string> = {
  inventory: 'Inventory',
  accounting: 'Accounting',
  pos: 'Point of Sale',
  crm: 'CRM',
}

/**
 * Every page the sidebar search can take the signed-in user to: the pages of
 * each module they have access to, the tabs inside its hubs, and their
 * settings pages. Built from the same navigation the sidebar draws and filtered
 * by the same rules, so a page only the menu hides from this user is never
 * offered — search is a shortcut through the menu, not around it.
 */
function buildSearchEntries(args: {
  session: SessionUser | null
  filterItem: (item: NavItem) => boolean
  hasAnyPermission: (required?: string | string[]) => boolean
  workspaceItems: NavItem[]
  /** Owner-only POS tabs (Settings, ...) show only for those who configure POS. */
  canConfigurePos: boolean
}): SearchEntry[] {
  const { session, filterItem, hasAnyPermission, workspaceItems, canConfigurePos } = args
  const entries: SearchEntry[] = []
  const seen = new Set<string>()
  const add = (entry: SearchEntry) => {
    const key = `${entry.href}|${entry.label}`
    if (seen.has(key)) return
    seen.add(key)
    entries.push(entry)
  }

  add({
    label: DASHBOARD_ITEM.label,
    href: DASHBOARD_ITEM.href,
    icon: DASHBOARD_ITEM.icon,
    path: [],
  })

  for (const [segment, config] of Object.entries(navItemsBySegment)) {
    if (segment === 'Business Owner' || !hasModuleAccess(session, segment)) continue
    const moduleLabel = MODULE_SECTION_LABELS[segment] ?? segment

    const appModule = MODULES.find((m) => m.key === segment)
    if (appModule) {
      add({
        label: appModule.label,
        href: appModule.href,
        icon: MODULE_ICON_MAP[appModule.icon] ?? Package,
        path: [],
      })
    }

    const items = [
      ...config.main,
      ...(config.groups ?? []).flatMap((g) => g.items),
      ...config.bottom,
    ]
    for (const item of items) {
      if (item.collapsible || !filterItem(item)) continue
      add({ label: item.label, href: item.href, icon: item.icon, path: [moduleLabel] })
      for (const sub of item.subItems ?? []) {
        if (!hasAnyPermission(sub.requiredPermission)) continue
        add({ label: sub.label, href: sub.href, icon: sub.icon, path: [moduleLabel, item.label] })
      }
    }

    // The tabs inside a hub are pages of their own the menu only reaches
    // through the hub's one row.
    const hubs: ReadonlyArray<{
      entryHref: string
      tabs: ReadonlyArray<{
        label: string
        href: string
        permissions: string[]
        icon?: LucideIcon
        configOnly?: boolean
        /** A tab that fronts a second row (POS Management) — the pages are what is searchable. */
        subTabs?: ReadonlyArray<{
          label: string
          href: string
          permissions: string[]
          icon?: LucideIcon
        }>
      }>
    }> = segment === 'accounting' ? Object.values(HUBS) : segment === 'pos' ? POS_HUBS : []
    for (const hub of hubs) {
      const parent = items.find((item) => item.href === hub.entryHref)
      if (!parent || !filterItem(parent)) continue
      for (const tab of hub.tabs) {
        if (tab.configOnly && !canConfigurePos) continue
        for (const page of tab.subTabs ?? [tab]) {
          if (page.permissions.length > 0 && !hasAnyPermission(page.permissions)) continue
          add({
            label: page.label,
            href: page.href,
            icon: page.icon ?? parent.icon,
            path: [moduleLabel, parent.label],
          })
        }
      }
    }
  }

  for (const item of workspaceItems) {
    add({ label: item.label, href: item.href, icon: item.icon, path: ['My Workspace'] })
  }
  return entries
}

function resolvePrimarySidebarSegment(session: SessionUser | null): string {
  switch (session?.primaryRole) {
    case 'Business Owner':
      return 'Business Owner'
    case 'Branch Manager':
      return 'Business Owner'
    case 'accounting':
      return 'accounting'
    case 'Stock Controller':
      return 'inventory'
    case 'Cashier':
    case 'pos':
      return 'pos'
    case 'Marketing Manager':
      return 'crm'
    default:
      break
  }

  if (session?.roles.includes('Business Owner')) return 'Business Owner'

  const allRoles = [
    ...(session?.primaryRole ? [session.primaryRole] : []),
    ...(session?.roles ?? []),
  ].map((r) => r.toLowerCase())

  if (allRoles.some((r) => r === 'cashier' || r === 'pos-manager' || r === 'pos')) return 'pos'
  if (allRoles.some((r) => r === 'stock controller' || r === 'stock-controller')) return 'inventory'

  if (session?.permissions.some((p) => p.startsWith('inventory:'))) return 'inventory'
  if (session?.permissions.some((p) => p.startsWith('accounting:'))) return 'accounting'
  if (session?.permissions.some((p) => p.startsWith('pos:'))) return 'pos'
  if (session?.permissions.some((p) => p.startsWith('crm:'))) return 'crm'

  return 'pos'
}

function resolveModuleSegment(pathSegment: string, session: SessionUser | null): string {
  if (!session) return 'pos'

  if (pathSegment === 'workspace') {
    return resolvePrimarySidebarSegment(session)
  }

  if (pathSegment === 'dashboard' || pathSegment === 'settings') {
    return resolvePrimarySidebarSegment(session)
  }

  // If already on a real module route, use it directly
  if (pathSegment !== 'dashboard' && pathSegment !== 'settings' && navItemsBySegment[pathSegment]) {
    return pathSegment
  }

  if (session.moduleAccess?.some((module) => navItemsBySegment[module])) {
    return session.moduleAccess.find((module) => navItemsBySegment[module]) ?? 'pos'
  }

  return resolvePrimarySidebarSegment(session)
}

export default function SideBar({ session }: { session: SessionUser | null }) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [pendingInviteCount, setPendingInviteCount] = useState(0)
  const [workspaceOpen, setWorkspaceOpen] = useState(false)

  const segment = pathname.split('/').filter(Boolean)[0] ?? 'dashboard'

  const resolvedSegment = resolveModuleSegment(segment, session)

  const isOwner =
    session?.primaryRole === 'Business Owner' || session?.roles.includes('Business Owner') || false

  // Refresh-on-navigation, not live — re-fetched whenever the route
  // changes rather than polled, matching how the rest of this app's nav
  // already behaves (Scenario 28, Part 2).
  useEffect(() => {
    if (!isOwner) return
    getPendingInviteCount().then((result) => {
      if (result.success && result.data) setPendingInviteCount(result.data.count)
    })
  }, [isOwner, pathname])

  // The pending Override Review count, shown on the Approvals item (and on the
  // Override Review tab inside it). Only fetched for someone who can open the
  // review, and only inside POS where the item shows.
  const canReviewOverrides = hasPermission(session, POS_PERMISSIONS.TRANSACTIONS_OVERRIDE)
  const overridePendingCount = usePosOverridePendingCount(canReviewOverrides && segment === 'pos')

  const workspaceItems: NavItem[] = WORKSPACE_ITEMS.map((item) =>
    item.href === '/settings/pending-invites' && pendingInviteCount > 0
      ? {
          ...item,
          badge: { text: String(pendingInviteCount), variant: 'count', color: 'bg-red-500' },
        }
      : item
  )

  const config = navItemsBySegment[resolvedSegment] ?? { main: [], bottom: [] }

  // "My Branch" mirrors what /settings/branches/[id] itself admits:
  // isAdmin(session), or primaryRole === 'Branch Manager' viewing their own
  // branch. The role check is not laziness — that page is still role-gated, and
  // the nav must not claim access the page will refuse.
  //
  // The branchId alone is NOT a sufficient test: session.branchId is derived
  // from the EMPLOYEE record (users.service.ts: user.employee?.branchId), so
  // every branch-assigned user has one — cashiers and stock controllers
  // included. Gating on it alone handed them a My Workspace block whose only
  // link redirected to /403.
  const bmWorkspaceItems =
    session?.primaryRole === 'Branch Manager' ? branchManagerWorkspaceItems(session?.branchId) : []
  const allWorkspaceItems = [...workspaceItems, ...bmWorkspaceItems]

  const hasAnyPermission = (required?: string | string[]) => {
    if (!required) return true
    const list = Array.isArray(required) ? required : [required]
    return list.some((p) => hasPermission(session, p))
  }

  // A parent with sub-items shows only while at least one child is visible.
  const filterItem = (item: NavItem) => {
    if (item.requiresModuleAccess && !hasModuleAccess(session, item.requiresModuleAccess)) {
      return false
    }
    if (item.exactPermission) return hasExactPermission(session, item.exactPermission)
    return (
      hasAnyPermission(item.requiredPermission) &&
      (!item.subItems || item.subItems.some((sub) => hasAnyPermission(sub.requiredPermission)))
    )
  }

  // One path for every role now: the settings block is whatever
  // allWorkspaceItems survives filterItem, appended to the current module's
  // own items. The 'Business Owner' segment is the settings-only view, with no
  // module items of its own, which is why it short-circuits.
  const visibleWorkspaceItems = allWorkspaceItems.filter(filterItem)

  let mainItems: NavItem[]
  if (resolvedSegment === 'Business Owner') {
    mainItems = visibleWorkspaceItems
  } else {
    const moduleLabel = MODULE_SECTION_LABELS[resolvedSegment] ?? resolvedSegment
    const labeledModuleItems = config.main
      .filter((item) => item.section !== 'My Workspace')
      .map((item) => ({ ...item, section: moduleLabel }))

    // Inside a module the settings block collapses to one header row that
    // expands in place, below the module's own items. Collapsed by default,
    // but forced open whenever one of its own pages is the current route, so
    // the sidebar never hides where you actually are.
    const workspaceHasActiveRoute = visibleWorkspaceItems.some(
      (item) => pathname === item.href || pathname.startsWith(item.href + '/')
    )
    const workspaceExpanded = workspaceOpen || workspaceHasActiveRoute

    const workspaceGroup: NavItem[] = visibleWorkspaceItems.length
      ? [
          {
            section: 'My Workspace',
            label: 'My Workspace',
            href: '/settings',
            icon: Settings,
            collapsible: {
              open: workspaceExpanded,
              onToggle: () => setWorkspaceOpen((value) => !value),
            },
          },
          ...(workspaceExpanded ? visibleWorkspaceItems : []),
        ]
      : []

    mainItems = [...labeledModuleItems, ...workspaceGroup]
  }

  const withBadge = (item: NavItem): NavItem =>
    item.href === APPROVALS_REVIEWS_HUB.entryHref && overridePendingCount > 0
      ? {
          ...item,
          badge: { text: String(overridePendingCount), variant: 'count', color: 'bg-orange-500' },
        }
      : item

  const withVisibleSubItems = (item: NavItem): NavItem =>
    item.subItems
      ? {
          ...item,
          subItems: item.subItems.filter((sub) => hasAnyPermission(sub.requiredPermission)),
        }
      : item

  // Module nav items — filtered by the user's moduleAccess
  const moduleNavItems: NavItem[] = MODULES.filter((m) => hasModuleAccess(session, m.key)).map(
    (m, idx) => ({
      label: m.label,
      href: m.href,
      icon: MODULE_ICON_MAP[m.icon] ?? Package,
      section: idx === 0 ? 'Modules' : undefined,
      usePrefix: true,
    })
  )

  // Always prepend Dashboard item so it's visible on every route
  // Deduplicate by href — moduleNavItems and config.main can both contain the same module root href
  // (unless the item opts out with keepBesideModuleRow)
  const rawMain = [
    DASHBOARD_ITEM,
    ...moduleNavItems,
    ...mainItems.filter(filterItem).map(withVisibleSubItems).map(withBadge),
  ]
  const seen = new Set<string>()
  const main = rawMain.filter((item) => {
    if (!item.keepBesideModuleRow && seen.has(item.href)) return false
    seen.add(item.href)
    return true
  })
  const finalBottom = config.bottom.filter(filterItem)
  const allItems = [...main, ...finalBottom]
  // Dashboard is always first in `main`; the search sits right under it.
  const dashboardItems = main.slice(0, 1)
  const scrollingItems = main.slice(1)

  // Same rule PosNav applies to the owner-only POS tabs (canManagePosSettings).
  const canConfigurePos =
    ADMIN_TIER.some((p) => hasPermission(session, p)) ||
    [session?.primaryRole ?? '', ...(session?.roles ?? [])].some(
      (r) => r === 'Branch Manager' || r === 'pos-manager'
    )
  const searchEntries = buildSearchEntries({
    session,
    filterItem,
    hasAnyPermission,
    workspaceItems: visibleWorkspaceItems,
    canConfigurePos,
  })

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`relative prominent-gradient hidden h-full flex-col pt-0 pb-4 px-2 transition-all duration-200 md:flex ${
          collapsed ? 'w-14' : 'w-64'
        }`}
      >
        {/* Floating collapse/expand button — edge of sidebar */}
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="absolute -right-3.5 top-5.5 z-50 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-prominent-purple-600 shadow-md ring-2 ring-white/20 transition-colors hover:bg-prominent-purple-700"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronLeft
            className={`h-3.5 w-3.5 text-white transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`}
          />
        </button>

        <nav className="flex flex-1 flex-col gap-1 min-h-0">
          {/* Dashboard, then search, then the rest. Both sit outside the scrolling
              list so the search results can open over the page. */}
          <div className="shrink-0 pt-4">
            <NavItems items={dashboardItems} pathname={pathname} collapsed={collapsed} />
          </div>
          <div className="shrink-0">
            <SidebarSearch
              entries={searchEntries}
              collapsed={collapsed}
              onExpand={() => setCollapsed(false)}
            />
          </div>
          <div className="flex-1 overflow-y-auto flex flex-col gap-1 pb-5 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-track]:transparent">
            <NavItems items={scrollingItems} pathname={pathname} collapsed={collapsed} />
          </div>
          {finalBottom.length > 0 && (
            <div className="shrink-0 pt-1 border-t border-white/10">
              <NavItems items={finalBottom} pathname={pathname} collapsed={collapsed} />
            </div>
          )}
        </nav>
      </aside>

      {/* Mobile bottom tab bar */}
      <nav className="prominent-gradient fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-purple-700/30 px-2 py-2 md:hidden">
        {allItems.slice(0, 4).map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={`${item.href}|${item.label}`}
              href={item.href}
              className="flex flex-col items-center gap-0.5"
            >
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-xl text-base transition-all ${
                  isActive ? 'bg-prominent-orange-200/30' : 'bg-white/10'
                }`}
              >
                <item.icon className="h-4 w-4 text-white" />
              </span>
              <span className="text-[10px] font-medium leading-tight text-white">
                {item.label.split(' ')[0]}
              </span>
            </Link>
          )
        })}

        {allItems.length > 4 && (
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex flex-col items-center gap-0.5"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-base">
              <MoreHorizontal className="h-4 w-4 text-white" />
            </span>
            <span className="text-[10px] font-medium text-white">More</span>
          </button>
        )}
      </nav>

      {/* Mobile drawer */}
      {drawerOpen && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/30 md:hidden"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl bg-white px-4 pb-8 pt-4 md:hidden shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-[14px] ml-2.5 font-semibold uppercase tracking-widest text-gray-700">
                Menu
              </span>
              <button
                onClick={() => setDrawerOpen(false)}
                className="rounded-full p-1 hover:bg-gray-100"
              >
                <X className="h-5 w-5 text-gray-700" />
              </button>
            </div>
            <nav className="flex flex-col gap-1">
              <NavItems
                items={allItems}
                pathname={pathname}
                collapsed={false}
                onClick={() => setDrawerOpen(false)}
                isMobile={true}
              />
            </nav>
          </div>
        </>
      )}
    </>
  )
}
