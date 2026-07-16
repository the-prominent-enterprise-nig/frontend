'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { hasModuleAccess, hasPermission } from '@/src/hooks/usePermission'
import { MODULES } from '@/src/libs/guards/modules'
import { CRM_PERMISSIONS } from '@/src/libs/guards/crm-permissions'
import {
  ArrowLeftRight,
  BarChart2,
  BarChart3,
  BellRing,
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ChevronUp,
  ClipboardList,
  ClipboardX,
  Coins,
  Contact,
  FileBarChart,
  FileSpreadsheet,
  ClipboardCheck,
  Funnel,
  HandCoins,
  House,
  IdCard,
  Key,
  Layers,
  Library,
  Monitor,
  MoreHorizontal,
  TrendingUp,
  Package,
  PackageCheck,
  Receipt,
  ReceiptText,
  RefreshCcw,
  Settings,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Tag,
  Truck,
  Undo2,
  Users,
  UsersRound,
  Wallet,
  Warehouse,
  X,
  type LucideIcon,
} from 'lucide-react'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { PROCUREMENT_PERMISSIONS } from '@/src/libs/guards/procurement-permissions'

type NavItem = {
  label: string
  href: string
  icon: LucideIcon
  requiredPermission?: string
  badge?: { text: string; variant: 'count' | 'new'; color?: string }
  subItems?: Array<{ label: string; href: string; icon: LucideIcon }>
  section?: string
  activeWhen?: string[]
  usePrefix?: boolean
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

const navItemsBySegment: Record<string, NavConfig> = {
  'Business Owner': {
    main: [],
    bottom: [],
  },
  inventory: {
    main: [
      {
        label: 'Stock',
        href: '/inventory/stock',
        icon: Package,
        requiredPermission: INVENTORY_PERMISSIONS.STOCKS_READ,
      },
      {
        label: 'Catalog',
        href: '/inventory/catalog',
        icon: Tag,
        requiredPermission: INVENTORY_PERMISSIONS.ITEMS_READ,
      },
      {
        label: 'Operations',
        href: '/inventory/operations',
        icon: ArrowLeftRight,
        requiredPermission: INVENTORY_PERMISSIONS.TRANSFERS_READ,
      },
      {
        label: 'Stock Requisitions',
        href: '/inventory/stock-requisitions',
        icon: ClipboardCheck,
        requiredPermission: INVENTORY_PERMISSIONS.STOCK_REQUISITIONS_READ,
      },
      {
        label: 'Purchase Requests',
        href: '/inventory/purchase-requests',
        icon: ClipboardList,
        requiredPermission: PROCUREMENT_PERMISSIONS.PR_READ,
      },
      {
        label: 'Purchase Orders',
        href: '/inventory/purchase-orders',
        icon: ShoppingCart,
        requiredPermission: PROCUREMENT_PERMISSIONS.PO_READ,
        activeWhen: ['/inventory/purchase-orders'],
      },
      {
        label: 'Suppliers',
        href: '/inventory/suppliers',
        icon: Truck,
        requiredPermission: PROCUREMENT_PERMISSIONS.SUPPLIERS_READ,
      },
      {
        label: 'Counting',
        href: '/inventory/counting',
        icon: RefreshCcw,
        requiredPermission: INVENTORY_PERMISSIONS.STOCK_COUNT_READ,
      },
      {
        label: 'Planning',
        href: '/inventory/planning',
        icon: BarChart2,
        requiredPermission: INVENTORY_PERMISSIONS.REORDER_READ,
      },
      {
        label: 'Finance',
        href: '/inventory/finance',
        icon: Coins,
        requiredPermission: INVENTORY_PERMISSIONS.COSTING_READ,
      },
      {
        label: 'Warehouses',
        href: '/inventory/warehouses',
        icon: Warehouse,
        requiredPermission: INVENTORY_PERMISSIONS.WAREHOUSES_READ,
      },
      {
        label: 'Unit Documents',
        href: '/inventory/uds',
        icon: ClipboardCheck,
        requiredPermission: INVENTORY_PERMISSIONS.UDS_READ,
      },
      {
        label: 'Reports',
        href: '/inventory/reports',
        icon: FileBarChart,
        requiredPermission: INVENTORY_PERMISSIONS.REPORTS_VALUATION,
      },
      {
        label: 'Settings',
        href: '/inventory/settings',
        icon: Settings,
      },
    ],
    bottom: [],
  },
  accounting: {
    main: [
      {
        label: 'Journal Entries',
        href: '/accounting/journal-entries',
        icon: ReceiptText,
      },
      {
        label: 'Chart of Accounts',
        href: '/accounting/chart-of-accounts',
        icon: BookOpen,
      },
      {
        label: 'Account Mapping',
        href: '/accounting/account-mapping',
        icon: Key,
      },
      {
        label: 'General Ledger',
        href: '/accounting/general-ledger',
        icon: Library,
      },
      {
        label: 'AR Invoices',
        href: '/accounting/ar-invoices',
        icon: Receipt,
      },
      {
        label: 'AP Bills',
        href: '/accounting/ap-bills',
        icon: ReceiptText,
      },
      {
        label: 'Expenses',
        href: '/accounting/expenses',
        icon: Coins,
      },
      {
        label: 'Bank Accounts',
        href: '/accounting/bank-accounts',
        icon: Wallet,
      },
      {
        label: 'Bank Reconciliation',
        href: '/accounting/bank-reconciliation',
        icon: HandCoins,
      },
      {
        label: 'Fixed Assets',
        href: '/accounting/fixed-assets',
        icon: ShoppingBag,
      },
      {
        label: 'Recurring Entries',
        href: '/accounting/recurring-entries',
        icon: RefreshCcw,
      },
      {
        label: 'Fiscal Periods',
        href: '/accounting/fiscal-periods',
        icon: CalendarDays,
      },
      {
        label: 'Vendors',
        href: '/accounting/vendors',
        icon: Truck,
      },
      {
        label: 'Customers',
        href: '/accounting/customers',
        icon: Users,
      },
      {
        label: 'Currencies',
        href: '/accounting/currencies',
        icon: Coins,
      },
      {
        label: 'Tax',
        href: '/accounting/tax',
        icon: FileSpreadsheet,
      },
      {
        label: 'Tax Rates',
        href: '/accounting/tax-rates',
        icon: Receipt,
      },
      {
        label: 'Budgets',
        href: '/accounting/budgets',
        icon: BarChart3,
      },
      {
        label: 'Cash Forecast',
        href: '/accounting/cash-forecast',
        icon: TrendingUp,
      },
      {
        label: 'FX Revaluation',
        href: '/accounting/fx-revaluation',
        icon: ArrowLeftRight,
      },
      {
        label: 'Reports',
        href: '/accounting/reports',
        icon: FileBarChart,
      },
    ],
    bottom: [],
  },
  pos: {
    main: [
      {
        label: 'Operations',
        href: '/pos',
        icon: ShoppingCart,
        requiredPermission: 'pos:transactions:read',
        activeWhen: ['/pos', '/pos/checkout', '/pos/transactions'],
      },
      {
        label: 'Management',
        href: '/pos/sessions',
        icon: Monitor,
        requiredPermission: 'pos:sessions:read',
        activeWhen: ['/pos/sessions', '/pos/cash-drawer', '/pos/terminals'],
      },
      {
        label: 'Cancellations',
        href: '/pos/cancellation-requests',
        icon: ClipboardX,
        requiredPermission: 'pos:sessions:read',
      },
      {
        label: 'Void Requests',
        href: '/pos/void-requests',
        icon: ShieldCheck,
        requiredPermission: 'pos:transactions:read',
      },
      {
        label: 'Release Approvals',
        href: '/pos/release-approvals',
        icon: PackageCheck,
        // Cashiers can view (not approve) their own submitted requests here —
        // matches the page's own guard (POS_PERMISSIONS.TRANSACTIONS_READ).
        requiredPermission: 'pos:transactions:read',
      },
      {
        label: 'Return & Refund Approvals',
        href: '/pos/return-refund-approvals',
        icon: Undo2,
        requiredPermission: 'pos:transaction:override',
      },
      {
        label: 'Promotions',
        href: '/pos/promo-codes',
        icon: Tag,
        requiredPermission: 'pos:promo-codes:read',
        activeWhen: ['/pos/promo-codes', '/pos/gift-cards', '/pos/loyalty', '/pos/branch-pricing'],
      },
      {
        label: 'Configuration',
        href: '/pos/gl-mapping',
        icon: Key,
        // Business Owner / Branch Manager only — pos:transactions:read (what
        // this used before) is also held by Cashier, which let them reach
        // GL Mapping / POS Config / Queue Categories.
        requiredPermission: 'pos:config:manage',
        activeWhen: ['/pos/gl-mapping', '/pos/settings', '/pos/config', '/pos/queue-categories'],
      },
      {
        // Every POS role needs their own PIN (checkout PIN entry, manager
        // approvals) — kept separate from the Configuration item above so
        // hiding that one from Cashier doesn't also remove their only way to
        // reach this.
        label: 'Cashier PIN',
        href: '/pos/pin',
        icon: Key,
      },
    ],
    bottom: [],
  },
  crm: {
    main: [
      {
        label: 'CRM Dashboard',
        href: '/crm',
        icon: House,
        requiredPermission: CRM_PERMISSIONS.LEADS_READ,
      },
      {
        label: 'Pipeline',
        href: '/crm/pipeline',
        icon: Funnel,
        requiredPermission: CRM_PERMISSIONS.PIPELINE_READ,
      },
      {
        label: 'Leads',
        href: '/crm/leads',
        icon: UsersRound,
        requiredPermission: CRM_PERMISSIONS.LEADS_READ,
      },
      {
        label: 'Customers',
        href: '/crm/customers',
        icon: Contact,
        requiredPermission: CRM_PERMISSIONS.CUSTOMERS_READ,
      },
      {
        label: 'Reminders',
        href: '/crm/reminders',
        icon: BellRing,
        requiredPermission: CRM_PERMISSIONS.REMINDERS_READ,
      },
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
  const isActive = item.activeWhen
    ? item.activeWhen.includes(pathname)
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

  return (
    <div className="relative group/dropdown">
      {/* Trigger — not a link, just a visual row */}
      <div
        className={`flex cursor-default items-center gap-2.5 rounded-lg px-2 py-1.5 transition-all duration-150 ${
          collapsed ? 'justify-center' : ''
        } ${isActive ? 'bg-prominent-orange-200/20' : isMobile ? 'hover:bg-gray-100' : 'hover:bg-gray-100/20'}`}
      >
        <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg">
          <item.icon
            className={`h-4 w-4 ${isMobile ? (isActive ? 'text-prominent-orange-700' : 'text-gray-700') : 'text-white'}`}
          />
        </span>
        {!collapsed && !isMobile && (
          <>
            <span className="flex-1 text-[13px] font-medium text-white">{item.label}</span>
            <ChevronUp className="h-3 w-3 text-white/50" />
          </>
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

      {/* Flyout — upward on desktop, right when collapsed */}
      <div
        className={`pointer-events-none absolute z-50 opacity-0 transition-all duration-150 group-hover/dropdown:pointer-events-auto group-hover/dropdown:opacity-100 ${
          collapsed ? 'left-full top-0 min-w-45 pl-3' : 'bottom-full left-0 w-full pb-2'
        }`}
      >
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
                onClick={onClick}
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
      </div>

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
        <div key={item.href}>
          {showSection && (
            <p
              className={`px-2 pb-1 pt-3 text-[10.5px] font-semibold uppercase tracking-wider ${
                isMobile ? 'text-zinc-400' : 'text-white/45'
              }`}
            >
              {item.section}
            </p>
          )}
          {item.subItems ? (
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

const MY_WORKSPACE_ITEMS: NavItem[] = []

const OWNER_WORKSPACE_ITEMS: NavItem[] = [
  {
    section: 'My Workspace',
    label: 'Users',
    href: '/settings/users',
    icon: UsersRound,
  },
  { section: 'My Workspace', label: 'Roles & Access', href: '/settings/roles', icon: ShieldCheck },
  { section: 'My Workspace', label: 'Branches', href: '/settings/branches', icon: Warehouse },
  {
    section: 'My Workspace',
    label: 'Reports',
    href: '/settings/export',
    icon: FileBarChart,
  },
  {
    section: 'My Workspace',
    label: 'Audit Logs',
    href: '/settings/audit-logs',
    icon: ClipboardList,
    requiredPermission: 'admin:audit-logs:read',
  },
  {
    section: 'My Workspace',
    label: 'Configuration',
    href: '/settings/configuration',
    icon: Settings,
  },
]

function branchManagerWorkspaceItems(branchId?: string | null): NavItem[] {
  return [
    ...(branchId
      ? [
          {
            section: 'My Workspace' as const,
            label: 'My Branch',
            href: `/settings/branches/${branchId}`,
            icon: Warehouse,
          },
        ]
      : []),
    // /settings/configuration's own page-level guard already allows Branch
    // Manager (POS PIN self-service, payment methods, receipt branding) —
    // without this the page was unreachable in practice since no nav link
    // pointed to it for this role.
    {
      section: 'My Workspace' as const,
      label: 'Configuration',
      href: '/settings/configuration',
      icon: Settings,
    },
  ]
}

const MODULE_SECTION_LABELS: Record<string, string> = {
  inventory: 'Inventory',
  accounting: 'Accounting',
  pos: 'Point of Sale',
  crm: 'CRM',
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

  const segment = pathname.split('/').filter(Boolean)[0] ?? 'dashboard'

  const resolvedSegment = resolveModuleSegment(segment, session)

  const isOwner =
    session?.primaryRole === 'Business Owner' || session?.roles.includes('Business Owner') || false

  const isBranchManager = session?.primaryRole === 'Branch Manager'

  const config = navItemsBySegment[resolvedSegment] ?? { main: [], bottom: [] }
  const moduleWithWorkspace = resolvedSegment !== 'Business Owner'

  const bmWorkspaceItems = branchManagerWorkspaceItems(session?.branchId)

  let mainItems: NavItem[]
  if (isOwner) {
    if (resolvedSegment === 'Business Owner') {
      mainItems = OWNER_WORKSPACE_ITEMS
    } else {
      const moduleLabel = MODULE_SECTION_LABELS[resolvedSegment] ?? resolvedSegment
      const moduleItems = config.main.filter((item) => item.section !== 'My Workspace')
      const labeledModuleItems = moduleItems.map((item) => ({ ...item, section: moduleLabel }))
      mainItems = [...labeledModuleItems, ...OWNER_WORKSPACE_ITEMS]
    }
  } else if (isBranchManager) {
    if (resolvedSegment === 'Business Owner') {
      mainItems = bmWorkspaceItems
    } else {
      const moduleLabel = MODULE_SECTION_LABELS[resolvedSegment] ?? resolvedSegment
      const moduleItems = config.main.filter((item) => item.section !== 'My Workspace')
      const labeledModuleItems = moduleItems.map((item) => ({ ...item, section: moduleLabel }))
      mainItems = [...labeledModuleItems, ...bmWorkspaceItems]
    }
  } else if (moduleWithWorkspace) {
    const moduleLabel = MODULE_SECTION_LABELS[resolvedSegment] ?? resolvedSegment
    const labeledModuleItems = config.main.map((item) => ({ ...item, section: moduleLabel }))
    mainItems = [...labeledModuleItems, ...MY_WORKSPACE_ITEMS]
  } else {
    mainItems = config.main
  }

  const filterItem = (item: NavItem) => {
    // Branch managers see all module items — data is scoped server-side by their branchId
    if (isBranchManager) return true
    if (item.requiredPermission && !hasPermission(session, item.requiredPermission)) return false
    return true
  }

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
  const rawMain = [DASHBOARD_ITEM, ...moduleNavItems, ...mainItems.filter(filterItem)]
  const seen = new Set<string>()
  const main = rawMain.filter((item) => {
    if (seen.has(item.href)) return false
    seen.add(item.href)
    return true
  })
  const finalBottom = config.bottom.filter(filterItem)
  const allItems = [...main, ...finalBottom]

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
          <div className="flex-1 overflow-y-auto flex flex-col gap-1 py-5 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-track]:transparent">
            <NavItems items={main} pathname={pathname} collapsed={collapsed} />
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
            <Link key={item.href} href={item.href} className="flex flex-col items-center gap-0.5">
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
