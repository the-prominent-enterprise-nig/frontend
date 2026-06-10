'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getMonthlySummary } from '@/src/libs/actions/leave.actions'
import {
  getOvertimeRequests,
  getAttendanceChangeRequests,
} from '@/src/app/(app)/(dashboard)/human-resource/attendance/_actions'
import { Button } from 'react-aria-components'
import { hasPermission } from '@/src/hooks/usePermission'
import { HR_PERMISSIONS } from '@/src/libs/guards/hr-permissions'
import { CRM_PERMISSIONS } from '@/src/libs/guards/crm-permissions'
import { PROCUREMENT_PERMISSIONS } from '@/src/libs/guards/procurement-permissions'
import {
  ArrowLeftRight,
  BarChart2,
  BarChart3,
  Bell,
  BellRing,
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ChevronUp,
  ClipboardList,
  Clock3,
  Coins,
  Contact,
  CreditCard,
  FileBarChart,
  FileSpreadsheet,
  FolderOpen,
  Funnel,
  HandCoins,
  House,
  Key,
  Layers,
  Library,
  MoreHorizontal,
  Package,
  Receipt,
  ReceiptText,
  Settings,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Tags,
  TrendingUp,
  Truck,
  Tv,
  Users,
  UsersRound,
  Wallet,
  Warehouse,
  X,
  PackageCheck,
  RefreshCcw,
  Monitor,
  Tag,
  Star,
  DollarSign,
  Sun,
  Timer,
  ChefHat,
  UtensilsCrossed,
  BookMarked,
  type LucideIcon,
} from 'lucide-react'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { useRestaurantConfig } from '@/src/libs/hooks/useRestaurantConfig'
import type { RestaurantCapabilities } from '@/src/libs/data/RestaurantData'

type NavItem = {
  label: string
  href: string
  icon: LucideIcon
  requiredPermission?: string
  requiresEmployeeId?: boolean
  badge?: { text: string; variant: 'count' | 'new'; color?: string }
  subItems?: Array<{ label: string; href: string; icon: LucideIcon }>
  section?: string
  activeWhen?: string[]
  requiredCapability?: keyof RestaurantCapabilities
}

type NavGroup = {
  label: string
  icon: LucideIcon
  items: NavItem[]
  restaurantModeOnly?: boolean
}

interface SessionUser {
  id: string
  employeeId?: string
  roles: string[]
  permissions: string[]
  primaryRole?: string
  moduleAccess?: string[]
}

type NavConfig = {
  main: NavItem[]
  groups?: NavGroup[]
  bottom: NavItem[]
}

const navItemsBySegment: Record<string, NavConfig> = {
  'enterprise-owner': {
    main: [
      { section: 'My Workspace', label: 'My Profile', href: '/workspace/profile', icon: Users },
    ],
    bottom: [],
  },
  'human-resource': {
    main: [
      {
        section: 'HR Management',
        label: 'Employee Masterlist',
        href: '/human-resource/employees',
        icon: Users,
        requiredPermission: HR_PERMISSIONS.EMPLOYEES_READ,
      },
      {
        section: 'HR Management',
        label: 'Attendance & Time',
        href: '/human-resource/attendance',
        icon: Clock3,
        requiredPermission: HR_PERMISSIONS.ATTENDANCE_READ,
      },
      {
        section: 'HR Management',
        label: 'Leave Management',
        href: '/human-resource/leave',
        icon: CalendarDays,
        requiredPermission: HR_PERMISSIONS.LEAVE_READ,
      },
      {
        section: 'HR Management',
        label: 'Holiday Calendar',
        href: '/human-resource/holidays',
        icon: Sun,
        requiredPermission: HR_PERMISSIONS.EMPLOYEES_READ,
      },
      {
        section: 'HR Management',
        label: 'Payroll',
        href: '/human-resource/payroll',
        icon: HandCoins,
        requiredPermission: HR_PERMISSIONS.PAYROLL_READ,
      },
      {
        section: 'HR Management',
        label: 'Payslips',
        href: '/human-resource/payslips',
        icon: ReceiptText,
        requiredPermission: HR_PERMISSIONS.PAYROLL_READ,
      },
      // {
      //   section: 'HR Management',
      //   label: 'HR Documents',
      //   href: '/human-resource/documents',
      //   icon: FolderOpen,
      //   requiredPermission: HR_PERMISSIONS.EMPLOYEES_READ,
      // },
      {
        section: 'My Workspace',
        label: 'My Profile',
        href: '/workspace/profile',
        icon: Users,
      },
      {
        section: 'My Workspace',
        label: 'My Payslips',
        href: '/workspace/payslips',
        icon: ReceiptText,
      },
      {
        section: 'My Workspace',
        label: 'My Leave',
        href: '/workspace/leave',
        icon: CalendarDays,
      },
      {
        section: 'My Workspace',
        label: 'My Time Log',
        href: '/workspace/time-log',
        icon: Timer,
      },
    ],
    bottom: [
      {
        label: 'Settings',
        href: '/human-resource/settings',
        icon: Settings,
      },
    ],
  },
  employee: {
    main: [
      { section: 'My Workspace', label: 'My Profile', href: '/workspace/profile', icon: Users },
      {
        section: 'My Workspace',
        label: 'My Payslips',
        href: '/workspace/payslips',
        icon: ReceiptText,
      },
      {
        section: 'My Workspace',
        label: 'My Leave',
        href: '/workspace/leave',
        icon: CalendarDays,
      },
      {
        section: 'My Workspace',
        label: 'My Time Log',
        href: '/workspace/time-log',
        icon: Timer,
      },
    ],
    bottom: [
      {
        label: 'Settings',
        href: '/human-resource/settings',
        icon: Settings,
      },
    ],
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
        icon: Tags,
        requiredPermission: INVENTORY_PERMISSIONS.ITEMS_READ,
      },
      {
        label: 'Operations',
        href: '/inventory/operations',
        icon: ArrowLeftRight,
        requiredPermission: INVENTORY_PERMISSIONS.TRANSFERS_READ,
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
        label: 'Reports',
        href: '/inventory/reports',
        icon: FileBarChart,
        requiredPermission: INVENTORY_PERMISSIONS.REPORTS_VALUATION,
      },
    ],
    bottom: [{ label: 'Settings', href: '/inventory/settings', icon: Settings }],
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
        icon: Clock3,
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
        activeWhen: [
          '/pos',
          '/pos/checkout',
          '/pos/order-queue',
          '/pos/parked-sales',
          '/pos/transactions',
        ],
      },
      {
        label: 'Management',
        href: '/pos/sessions',
        icon: Monitor,
        requiredPermission: 'pos:sessions:read',
        activeWhen: ['/pos/sessions', '/pos/cash-drawer', '/pos/terminals'],
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
        requiredPermission: 'pos:transactions:read',
        activeWhen: ['/pos/gl-mapping', '/pos/pin', '/pos/settings', '/pos/config'],
      },
    ],
    bottom: [
      {
        label: 'Settings',
        href: '/pos/settings',
        icon: Settings,
      },
    ],
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
    ],
    bottom: [{ label: 'Settings', href: '/crm/settings', icon: Settings }],
  },
  'queue-management': {
    main: [
      { label: 'Queue Dashboard', href: '/queue-management', icon: Bell },
      { label: 'Public Display', href: '/queue-management/display', icon: Tv },
      { label: 'Order Board', href: '/queue-management/order-board', icon: ChefHat },
      { label: 'Reports', href: '/queue-management/reports', icon: FileBarChart },
    ],
    groups: [
      {
        label: 'Restaurant',
        icon: UtensilsCrossed,
        restaurantModeOnly: true,
        items: [
          {
            label: 'Floor Board',
            href: '/queue-management/restaurant',
            icon: Layers,
            requiredCapability: 'floorPlan',
          },
          {
            label: 'Kitchen Display',
            href: '/queue-management/restaurant/kitchen',
            icon: ChefHat,
            requiredCapability: 'kitchenDisplay',
          },
          {
            label: 'Bookings',
            href: '/queue-management/restaurant/bookings',
            icon: BookMarked,
            requiredCapability: 'reservations',
          },
          {
            label: 'Server Sections',
            href: '/queue-management/restaurant/server-sections',
            icon: UsersRound,
            requiredCapability: 'serverSections',
          },
          {
            label: 'Feedback',
            href: '/queue-management/restaurant/feedback',
            icon: Star,
            requiredCapability: 'feedback',
          },
          {
            label: 'Restaurant Settings',
            href: '/queue-management/restaurant/settings',
            icon: Settings,
          },
        ],
      },
    ],
    bottom: [{ label: 'Queue Settings', href: '/queue-management/settings', icon: Settings }],
  },
  sales: {
    main: [
      { label: 'Customers', href: '/sales/customers', icon: Users },
      { label: 'Quotations', href: '/sales/quotations', icon: ClipboardList },
      { label: 'Sales Orders', href: '/sales/orders', icon: ShoppingCart },
      { label: 'Deliveries', href: '/sales/deliveries', icon: PackageCheck },
      { label: 'Invoices', href: '/sales/invoices', icon: Receipt },
      { label: 'Returns', href: '/sales/returns', icon: RefreshCcw },
      { label: 'Reports', href: '/sales/reports', icon: BarChart3 },
    ],
    bottom: [{ label: 'Settings', href: '/sales/settings', icon: Settings }],
  },
  procurement: {
    main: [
      {
        label: 'Suppliers',
        href: '/procurement/suppliers',
        icon: Truck,
        requiredPermission: PROCUREMENT_PERMISSIONS.SUPPLIERS_READ,
      },
      {
        label: 'Purchase Requests',
        href: '/procurement/purchase-requests',
        icon: ClipboardList,
        requiredPermission: PROCUREMENT_PERMISSIONS.PR_READ,
      },
      {
        label: 'Purchase Orders',
        href: '/procurement/purchase-orders',
        icon: Receipt,
        requiredPermission: PROCUREMENT_PERMISSIONS.PO_READ,
      },
      {
        label: 'Goods Receiving',
        href: '/procurement/goods-receiving',
        icon: PackageCheck,
        requiredPermission: PROCUREMENT_PERMISSIONS.GR_READ,
      },
    ],
    bottom: [{ label: 'Settings', href: '/procurement/settings', icon: Settings }],
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
  const isActive = item.activeWhen ? item.activeWhen.includes(pathname) : pathname === item.href
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

function CollapsibleNavGroup({
  group,
  pathname,
  collapsed,
  onClick,
  isMobile = false,
}: {
  group: NavGroup
  pathname: string
  collapsed: boolean
  onClick?: () => void
  isMobile?: boolean
}) {
  const hasActive = group.items.some(
    (item) => pathname === item.href || pathname.startsWith(item.href + '/')
  )
  const [open, setOpen] = useState(hasActive)

  useEffect(() => {
    if (hasActive) setOpen(true)
  }, [hasActive])

  return (
    <div>
      <button
        onClick={() => !collapsed && setOpen((v) => !v)}
        className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 transition-all duration-150 ${
          collapsed ? 'justify-center' : ''
        } ${hasActive ? 'bg-prominent-orange-200/20' : isMobile ? 'hover:bg-gray-100' : 'hover:bg-gray-100/20'}`}
      >
        <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
          <group.icon
            className={`h-6 w-6 ${isMobile ? (hasActive ? 'text-prominent-orange-700' : 'text-gray-700') : 'text-white'}`}
          />
        </span>
        {!collapsed && (
          <>
            <span
              className={`flex-1 text-left text-[13px] font-medium leading-tight ${isMobile ? (hasActive ? 'text-prominent-orange-700' : 'text-gray-800') : 'text-white'}`}
            >
              {group.label}
            </span>
            <ChevronUp
              className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${open ? '' : 'rotate-180'} ${isMobile ? 'text-gray-400' : 'text-white/50'}`}
            />
          </>
        )}
      </button>

      {!collapsed && open && (
        <div
          className={`ml-3 mt-0.5 space-y-0.5 border-l pl-2 ${isMobile ? 'border-gray-200' : 'border-white/10'}`}
        >
          {group.items.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              pathname={pathname}
              collapsed={false}
              onClick={onClick}
              isMobile={isMobile}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function NavItems({
  items,
  groups,
  pathname,
  collapsed,
  onClick,
  isMobile = false,
}: {
  items: NavItem[]
  groups?: NavGroup[]
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
      {groups?.map((group) => (
        <CollapsibleNavGroup
          key={group.label}
          group={group}
          pathname={pathname}
          collapsed={collapsed}
          onClick={onClick}
          isMobile={isMobile}
        />
      ))}
    </>
  )
}

const DASHBOARD_ITEM: NavItem = { label: 'Dashboard', href: '/dashboard', icon: House }

const MY_WORKSPACE_ITEMS: NavItem[] = [
  { section: 'My Workspace', label: 'My Profile', href: '/workspace/profile', icon: Users },
  {
    section: 'My Workspace',
    label: 'My Payslips',
    href: '/workspace/payslips',
    icon: ReceiptText,
  },
  { section: 'My Workspace', label: 'My Leave', href: '/workspace/leave', icon: CalendarDays },
  { section: 'My Workspace', label: 'My Time Log', href: '/workspace/time-log', icon: Timer },
]

const OWNER_WORKSPACE_ITEMS: NavItem[] = [
  { section: 'My Workspace', label: 'My Profile', href: '/workspace/profile', icon: Users },
  {
    section: 'My Workspace',
    label: 'Users',
    href: '/settings/users',
    icon: UsersRound,
  },
  { section: 'My Workspace', label: 'Roles & Access', href: '/settings/roles', icon: ShieldCheck },
  {
    section: 'My Workspace',
    label: 'Leave Requests',
    href: '/settings/leave-requests',
    icon: CalendarDays,
  },
  { section: 'My Workspace', label: 'Branches', href: '/settings/branches', icon: Warehouse },
  {
    section: 'My Workspace',
    label: 'Subscription',
    href: '/settings/subscription',
    icon: CreditCard,
  },
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
]

const MODULE_SECTION_LABELS: Record<string, string> = {
  'human-resource': 'HR & Payroll',
  inventory: 'Inventory',
  accounting: 'Accounting',
  pos: 'Point of Sale',
  crm: 'CRM',
  'queue-management': 'Queue Management',
  sales: 'Sales',
  procurement: 'Procurement',
}

function resolvePrimarySidebarSegment(session: SessionUser | null): string {
  switch (session?.primaryRole) {
    case 'enterprise-owner':
      return 'enterprise-owner'
    case 'hr':
      return 'human-resource'
    case 'employee':
      return 'employee'
    case 'accounting':
      return 'accounting'
    case 'inventory':
      return 'inventory'
    case 'pos':
      return 'pos'
    case 'queue':
      return 'queue-management'
    default:
      break
  }

  if (session?.roles.includes('enterprise-owner')) return 'enterprise-owner'
  if (session?.roles.includes('cashier') || session?.roles.includes('pos-manager')) return 'pos'
  if (session?.permissions.some((p) => p.startsWith('hr:'))) return 'human-resource'
  if (session?.permissions.some((p) => p.startsWith('inventory:'))) return 'inventory'
  if (session?.permissions.some((p) => p.startsWith('accounting:'))) return 'accounting'
  if (session?.permissions.some((p) => p.startsWith('pos:'))) return 'pos'
  if (session?.permissions.some((p) => p.startsWith('queue:'))) return 'queue-management'
  if (session?.permissions.some((p) => p.startsWith('crm:'))) return 'crm'
  if (session?.permissions.some((p) => p.startsWith('procurement:'))) return 'procurement'
  if (session?.permissions.some((p) => p.startsWith('sales:'))) return 'sales'

  return 'human-resource'
}

/**
 * Resolve which module sidebar to show based on path + session.
 * On /dashboard and /settings we fall back to the user's primary module.
 * On /workspace routes (user profile), we use the user's primary role (not a module).
 */
function resolveModuleSegment(pathSegment: string, session: SessionUser | null): string {
  if (!session) return 'human-resource'

  // Workspace routes should use primary role, not modules
  if (pathSegment === 'workspace') {
    return resolvePrimarySidebarSegment(session)
  }

  if (pathSegment === 'dashboard' || pathSegment === 'settings') {
    return resolvePrimarySidebarSegment(session)
  }

  if (session.primaryRole === 'hr') return 'human-resource'
  if (session.primaryRole === 'employee') return 'employee'

  // If already on a real module route, use it directly
  if (pathSegment !== 'dashboard' && pathSegment !== 'settings' && navItemsBySegment[pathSegment]) {
    return pathSegment
  }

  // Fall back to role/permission-based resolution
  if (session.moduleAccess?.includes('queue-management')) return 'queue-management'
  if (session.moduleAccess?.some((module) => navItemsBySegment[module])) {
    return session.moduleAccess.find((module) => navItemsBySegment[module]) ?? 'human-resource'
  }

  return resolvePrimarySidebarSegment(session)
}

export default function SideBar({ session }: { session: SessionUser | null }) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const hasHRAccess = session?.permissions.some((p) => p.startsWith('hr:')) ?? false
  const { data: restaurantConfig } = useRestaurantConfig()

  const { data: leaveSummary } = useQuery({
    queryKey: ['sidebar-leave-pending'],
    queryFn: () => getMonthlySummary(),
    enabled: hasHRAccess,
    staleTime: 60_000,
  })

  const { data: overtimeRequests = [] } = useQuery({
    queryKey: ['overtime-requests'],
    queryFn: getOvertimeRequests,
    enabled: hasHRAccess,
    staleTime: 60_000,
  })

  const { data: correctionRequests = [] } = useQuery({
    queryKey: ['attendance-change-requests'],
    queryFn: getAttendanceChangeRequests,
    enabled: hasHRAccess,
    staleTime: 60_000,
  })

  const pendingLeaveCount =
    leaveSummary?.success === true
      ? ((leaveSummary as { success: true; data: { pending?: number } }).data?.pending ?? 0)
      : 0

  const pendingAttendanceCount =
    overtimeRequests.filter((r) => r.status === 'PENDING').length +
    correctionRequests.filter((r) => r.status?.toLowerCase() === 'pending').length

  let segment = pathname.split('/').filter(Boolean)[0] ?? 'dashboard'
  const isWorkspaceRoute = [
    '/workspace/profile',
    '/workspace/payslips',
    '/workspace/leave',
    '/workspace/time-log',
  ].includes(pathname)

  const isEmployee = session?.primaryRole === 'employee'

  if (isEmployee && segment === 'human-resource') {
    segment = 'employee'
  }

  if (
    isWorkspaceRoute &&
    session?.primaryRole &&
    !['enterprise-owner', 'hr', 'employee'].includes(session.primaryRole)
  ) {
    segment = resolvePrimarySidebarSegment(session)
  }

  // Resolve which module's sidebar config to display (falls back to role-based on /dashboard & /settings)
  const resolvedSegment = resolveModuleSegment(segment, session)
  const effectiveSegment =
    isEmployee && resolvedSegment === 'human-resource' ? 'employee' : resolvedSegment

  const isOwner =
    session?.primaryRole === 'enterprise-owner' ||
    session?.roles.includes('enterprise-owner') ||
    false

  const config = navItemsBySegment[effectiveSegment] ?? { main: [], bottom: [] }
  const moduleWithWorkspace = !['enterprise-owner', 'human-resource', 'employee'].includes(
    effectiveSegment
  )

  let mainItems: NavItem[]
  if (isOwner) {
    if (effectiveSegment === 'enterprise-owner') {
      mainItems = OWNER_WORKSPACE_ITEMS
    } else {
      const moduleLabel = MODULE_SECTION_LABELS[effectiveSegment] ?? effectiveSegment
      const moduleItems = config.main.filter((item) => item.section !== 'My Workspace')
      const labeledModuleItems = moduleItems.map((item, idx) =>
        idx === 0 ? { ...item, section: moduleLabel } : item
      )
      mainItems = [...OWNER_WORKSPACE_ITEMS, ...labeledModuleItems]
    }
  } else if (moduleWithWorkspace) {
    const moduleLabel = MODULE_SECTION_LABELS[effectiveSegment] ?? effectiveSegment
    const labeledModuleItems = config.main.map((item, idx) =>
      idx === 0 ? { ...item, section: moduleLabel } : item
    )
    mainItems = [...(session?.employeeId ? MY_WORKSPACE_ITEMS : []), ...labeledModuleItems]
  } else {
    mainItems = config.main
  }

  const filterItem = (item: NavItem) => {
    if (item.requiredPermission && !hasPermission(session, item.requiredPermission)) return false
    if (item.requiresEmployeeId && !session?.employeeId) return false
    if (item.requiredCapability && !restaurantConfig?.capabilities?.[item.requiredCapability])
      return false
    return true
  }

  const groups = (config.groups ?? [])
    .filter((g) => !g.restaurantModeOnly || restaurantConfig?.mode === 'RESTAURANT')
    .map((g) => ({ ...g, items: g.items.filter(filterItem) }))
    .filter((g) => g.items.length > 0)

  // Always prepend Dashboard item so it's visible on every route
  const main = [DASHBOARD_ITEM, ...mainItems.filter(filterItem)].map((item) => {
    if (item.href === '/human-resource/leave' && pendingLeaveCount > 0) {
      return {
        ...item,
        badge: { text: String(pendingLeaveCount), variant: 'count' as const, color: 'bg-red-400' },
      }
    }
    if (item.href === '/human-resource/attendance' && pendingAttendanceCount > 0) {
      return {
        ...item,
        badge: {
          text: String(pendingAttendanceCount),
          variant: 'count' as const,
          color: 'bg-yellow-400',
        },
      }
    }
    return item
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
        <Button
          onClick={() => setCollapsed((v) => !v)}
          className="absolute -right-3.5 top-5.5 z-50 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-prominent-purple-600 shadow-md ring-2 ring-white/20 transition-colors hover:bg-prominent-purple-700"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronLeft
            className={`h-3.5 w-3.5 text-white transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`}
          />
        </Button>

        <nav className="flex flex-1 flex-col gap-1 min-h-0">
          <div className="flex-1 overflow-y-auto flex flex-col gap-1 py-5 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-track]:transparent">
            <NavItems items={main} groups={groups} pathname={pathname} collapsed={collapsed} />
          </div>
          <div className="shrink-0 pt-1 border-t border-white/10">
            <NavItems items={finalBottom} pathname={pathname} collapsed={collapsed} />
          </div>
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
          <Button
            onPress={() => setDrawerOpen(true)}
            className="flex flex-col items-center gap-0.5"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-base">
              <MoreHorizontal className="h-4 w-4 text-white" />
            </span>
            <span className="text-[10px] font-medium text-white">More</span>
          </Button>
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
              <Button
                onPress={() => setDrawerOpen(false)}
                className="rounded-full p-1 hover:bg-gray-100"
              >
                <X className="h-5 w-5 text-gray-700" />
              </Button>
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
