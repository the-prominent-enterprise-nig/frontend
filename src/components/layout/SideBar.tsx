'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { getPendingInviteCount } from '@/src/app/(app)/(dashboard)/settings/_actions/get-pending-invite-count'
import { hasModuleAccess, hasPermission } from '@/src/hooks/usePermission'
import { MODULES } from '@/src/libs/guards/modules'
import { CRM_PERMISSIONS } from '@/src/libs/guards/crm-permissions'
import {
  ArrowLeftRight,
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
  CreditCard,
  FileBarChart,
  FileCheck2,
  FilePlus,
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
  Percent,
  Receipt,
  ReceiptText,
  RefreshCcw,
  ScrollText,
  Settings,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Tag,
  Tags,
  Truck,
  Undo2,
  Users,
  UsersRound,
  UserPlus,
  Wallet,
  Warehouse,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { PROCUREMENT_PERMISSIONS } from '@/src/libs/guards/procurement-permissions'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import { POS_PERMISSIONS } from '@/src/libs/guards/pos-permissions'

type NavItem = {
  label: string
  href: string
  icon: LucideIcon
  requiredPermission?: string | string[]
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
        label: 'Price Lists',
        href: '/inventory/price-lists',
        icon: Tags,
        requiredPermission: INVENTORY_PERMISSIONS.PRICE_LISTS_READ,
      },
      {
        label: 'Purchase Orders',
        href: '/inventory/purchase-orders',
        icon: ShoppingCart,
        requiredPermission: [PROCUREMENT_PERMISSIONS.PO_READ, PROCUREMENT_PERMISSIONS.PR_READ],
        activeWhen: ['/inventory/purchase-orders'],
      },
      {
        label: 'Stock Transfers',
        href: '/inventory/operations',
        icon: ArrowLeftRight,
        requiredPermission: [
          INVENTORY_PERMISSIONS.TRANSFERS_READ,
          INVENTORY_PERMISSIONS.RECEIVE_READ,
          INVENTORY_PERMISSIONS.RETURNS_READ,
          INVENTORY_PERMISSIONS.QUALITY_HOLD_READ,
          INVENTORY_PERMISSIONS.BACKORDERS_READ,
          INVENTORY_PERMISSIONS.STOCK_ADJUST,
          INVENTORY_PERMISSIONS.STOCK_ADJUSTMENT_CONFIRM,
          INVENTORY_PERMISSIONS.STOCK_ADJUSTMENT_INVESTIGATE,
          INVENTORY_PERMISSIONS.STOCK_ADJUSTMENT_APPROVE,
        ],
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
    // Reordered per developer request (2026-08-20): day-to-day
    // transactional/operational screens first, reporting next, setup/
    // configuration screens (touched rarely, once things are set up) last.
    // Same items, same permissions — order only.
    main: [
      // ── Core transactions ──
      {
        label: 'Journal Entries',
        href: '/accounting/journal-entries',
        icon: ReceiptText,
        requiredPermission: ACCOUNTING_PERMISSIONS.JOURNAL_ENTRY_READ,
      },
      {
        label: 'General Ledger',
        href: '/accounting/general-ledger',
        icon: Library,
        requiredPermission: ACCOUNTING_PERMISSIONS.FINANCIAL_REPORT_READ,
      },
      {
        label: 'AR Invoices',
        href: '/accounting/ar-invoices',
        icon: Receipt,
        requiredPermission: ACCOUNTING_PERMISSIONS.AR_INVOICES_READ,
      },
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
        requiredPermission: ACCOUNTING_PERMISSIONS.DEBIT_MEMOS_READ,
      },
      {
        label: 'AP Bills',
        href: '/accounting/ap-bills',
        icon: ReceiptText,
        requiredPermission: ACCOUNTING_PERMISSIONS.AP_BILLS_READ,
      },
      {
        label: 'Receiving Reports',
        href: '/accounting/receiving-reports',
        icon: Receipt,
        requiredPermission: ACCOUNTING_PERMISSIONS.FINANCIAL_REPORT_READ,
      },
      {
        label: 'Expenses',
        href: '/accounting/expenses',
        icon: Coins,
        requiredPermission: ACCOUNTING_PERMISSIONS.EXPENSE_READ,
      },
      {
        label: 'Customers',
        href: '/accounting/customers',
        icon: Users,
        requiredPermission: ACCOUNTING_PERMISSIONS.CUSTOMER_READ,
      },
      {
        label: 'Unapplied Collections',
        href: '/accounting/unapplied-collections',
        icon: Wallet,
        requiredPermission: ACCOUNTING_PERMISSIONS.UNAPPLIED_COLLECTIONS_READ,
      },
      {
        label: 'Withholding Tax (CWT)',
        href: '/accounting/withholding-tax',
        icon: FileCheck2,
        requiredPermission: ACCOUNTING_PERMISSIONS.AR_INVOICES_READ,
      },
      // ── Operational / periodic ──
      {
        label: 'Bank Reconciliation',
        href: '/accounting/bank-reconciliation',
        icon: HandCoins,
        requiredPermission: ACCOUNTING_PERMISSIONS.BANK_ACCOUNTS_READ,
      },
      {
        label: 'Recurring Entries',
        href: '/accounting/recurring-entries',
        icon: RefreshCcw,
        requiredPermission: ACCOUNTING_PERMISSIONS.RECURRING_ENTRIES_READ,
      },
      {
        label: 'Interest Release',
        href: '/accounting/installment-interest-release',
        icon: Percent,
        requiredPermission: ACCOUNTING_PERMISSIONS.INSTALLMENT_INTEREST_RELEASE,
      },
      {
        label: 'Cash Forecast',
        href: '/accounting/cash-forecast',
        icon: TrendingUp,
        requiredPermission: ACCOUNTING_PERMISSIONS.CASH_FORECAST_READ,
      },
      {
        label: 'Budgets',
        href: '/accounting/budgets',
        icon: BarChart3,
        requiredPermission: ACCOUNTING_PERMISSIONS.BUDGET_READ,
      },
      {
        label: 'Fixed Assets',
        href: '/accounting/fixed-assets',
        icon: ShoppingBag,
        requiredPermission: ACCOUNTING_PERMISSIONS.FIXED_ASSET_READ,
      },
      // ── Reports ──
      {
        label: 'Reports',
        href: '/accounting/reports',
        icon: FileBarChart,
        requiredPermission: ACCOUNTING_PERMISSIONS.FINANCIAL_REPORT_READ,
      },
      // ── Setup / configuration ──
      {
        label: 'Chart of Accounts',
        href: '/accounting/chart-of-accounts',
        icon: BookOpen,
        requiredPermission: ACCOUNTING_PERMISSIONS.ACCOUNT_READ,
      },
      {
        label: 'Account Mapping',
        href: '/accounting/account-mapping',
        icon: Key,
        requiredPermission: [ACCOUNTING_PERMISSIONS.ACCOUNT_READ, POS_PERMISSIONS.CONFIG_READ],
      },
      {
        label: 'AP Payment Methods',
        href: '/accounting/ap-payment-methods',
        icon: CreditCard,
        requiredPermission: ACCOUNTING_PERMISSIONS.AP_PAYMENT_METHODS_READ,
      },
      {
        label: 'Bank Accounts',
        href: '/accounting/bank-accounts',
        icon: Wallet,
        requiredPermission: ACCOUNTING_PERMISSIONS.BANK_ACCOUNTS_READ,
      },
      {
        label: 'Fiscal Periods',
        href: '/accounting/fiscal-periods',
        icon: CalendarDays,
        requiredPermission: ACCOUNTING_PERMISSIONS.FISCAL_READ,
      },
      {
        label: 'Tax',
        href: '/accounting/tax',
        icon: FileSpreadsheet,
        requiredPermission: ACCOUNTING_PERMISSIONS.TAX_READ,
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
        label: 'Credit Applications',
        href: '/pos/credit-applications',
        icon: CreditCard,
        // pos:application:view — credit was folded into the pos module
        // (Scenario 22, 2026-08-08). A Credit Investigator holds only this
        // narrow slice of pos:* (no sessions/transactions/etc.), and still
        // needs their own way into this page (see filterItem below, which
        // checks each item's own requiredPermission independently).
        requiredPermission: 'pos:application:view',
        // Has a real [id] detail route (unlike its sibling items here,
        // which are all single-page-with-modals) — without this, viewing
        // an application's detail page wouldn't highlight this as active.
        usePrefix: true,
      },
      {
        label: 'Management',
        href: '/pos/sessions',
        icon: Monitor,
        requiredPermission: 'pos:sessions:read',
        // '/pos/terminals' moved under Settings (/pos/settings/terminals,
        // already covered by that item's own activeWhen) — Management no
        // longer has anything to do with Terminals.
        activeWhen: ['/pos/sessions', '/pos/cash-drawer'],
      },
      {
        // Sidebar gate must match the page's own guard
        // (POS_PERMISSIONS.TRANSACTIONS_OVERRIDE / getPending's backend
        // check) — Cashier holds pos:sessions:read but not this, so the
        // old 'pos:sessions:read' gate let them see the link and then get
        // redirected/403'd once inside. Business Owner and Branch Manager
        // both hold pos:transaction:override and keep access.
        label: 'Cancellations',
        href: '/pos/cancellation-requests',
        icon: ClipboardX,
        requiredPermission: 'pos:transaction:override',
      },
      {
        label: 'Void Requests',
        href: '/pos/void-requests',
        icon: ShieldCheck,
        requiredPermission: 'pos:transactions:read',
      },
      {
        label: 'Service Jobs',
        href: '/pos/service-jobs',
        icon: Wrench,
        requiredPermission: 'pos:service-drafts:read',
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
        label: 'Refund Approvals',
        href: '/pos/return-refund-approvals',
        icon: Undo2,
        requiredPermission: 'pos:transaction:override',
      },
      {
        label: 'Promotions',
        href: '/pos/promo-codes',
        icon: Tag,
        requiredPermission: 'pos:promo-codes:read',
        activeWhen: ['/pos/promo-codes', '/pos/gift-cards', '/pos/loyalty'],
      },
      {
        label: 'Branch Pricing',
        href: '/pos/branch-pricing',
        icon: HandCoins,
        requiredPermission: 'pos:branch-pricing:read',
      },
      {
        label: 'Settings',
        href: '/pos/settings',
        icon: Key,
        // The layout's actual guard (canManagePosSettings) is role-based —
        // Business Owner or Branch Manager only — not permission-based, and
        // Cashier holds pos:config:manage too (module-wildcard-minus-
        // transaction:override grant), so gating on that let Cashier see
        // the link and then get redirected to /403 once inside.
        // pos:transaction:override is the one pos permission Cashier is
        // deliberately denied, so it's the closest match to "Business
        // Owner / Branch Manager only" the sidebar's permission model has.
        requiredPermission: 'pos:transaction:override',
        // Exact-match list, not a prefix check (see isActive below) — every
        // /pos/settings/* sub-route needs its own explicit entry.
        activeWhen: [
          '/pos/settings',
          '/pos/settings/general',
          '/pos/settings/payment-methods',
          '/pos/settings/terminals',
          '/pos/settings/receipt-branding',
          '/pos/settings/financing-terms',
          '/pos/settings/customer-display',
        ],
      },
      {
        label: 'Cash-in-Transit',
        href: '/pos/cash-in-transit',
        icon: Wallet,
        requiredPermission: 'pos:cash-in-transit:read',
      },
      {
        label: 'Collections',
        href: '/pos/collections',
        icon: Coins,
        requiredPermission: 'pos:collections:manage',
      },
      {
        // Every POS role needs their own PIN (checkout PIN entry, manager
        // approvals) — kept separate from the Settings item above so hiding
        // that one from Cashier doesn't also remove their only way to reach
        // this.
        label: 'POS PIN',
        href: '/pos/pin',
        icon: Key,
      },
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
      {
        label: 'Collections Calendar',
        href: '/crm/collections-calendar',
        icon: CalendarDays,
        requiredPermission: CRM_PERMISSIONS.COLLECTIONS_CALENDAR_READ,
      },
      {
        label: 'Collection Incentives',
        href: '/crm/collection-incentives',
        icon: Coins,
        requiredPermission: CRM_PERMISSIONS.INCENTIVES_READ,
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
  {
    section: 'My Workspace',
    label: 'Pending Invites',
    href: '/settings/pending-invites',
    icon: UserPlus,
  },
  { section: 'My Workspace', label: 'Roles & Access', href: '/settings/roles', icon: ShieldCheck },
  { section: 'My Workspace', label: 'Branches', href: '/settings/branches', icon: Warehouse },
  {
    section: 'My Workspace',
    label: 'Business Policies',
    href: '/settings/business-policies',
    icon: ScrollText,
  },
  {
    section: 'My Workspace',
    label: 'Payment Methods',
    href: '/settings/payment-methods',
    icon: Wallet,
  },
  {
    section: 'My Workspace',
    label: 'Audit Logs',
    href: '/settings/audit-logs',
    icon: ClipboardList,
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

  const segment = pathname.split('/').filter(Boolean)[0] ?? 'dashboard'

  const resolvedSegment = resolveModuleSegment(segment, session)

  const isOwner =
    session?.primaryRole === 'Business Owner' || session?.roles.includes('Business Owner') || false

  const isBranchManager = session?.primaryRole === 'Branch Manager'

  // Refresh-on-navigation, not live — re-fetched whenever the route
  // changes rather than polled, matching how the rest of this app's nav
  // already behaves (Scenario 28, Part 2).
  useEffect(() => {
    if (!isOwner) return
    getPendingInviteCount().then((result) => {
      if (result.success && result.data) setPendingInviteCount(result.data.count)
    })
  }, [isOwner, pathname])

  const ownerWorkspaceItems: NavItem[] = isOwner
    ? OWNER_WORKSPACE_ITEMS.map((item) =>
        item.href === '/settings/pending-invites' && pendingInviteCount > 0
          ? {
              ...item,
              badge: { text: String(pendingInviteCount), variant: 'count', color: 'bg-red-500' },
            }
          : item
      )
    : OWNER_WORKSPACE_ITEMS

  const config = navItemsBySegment[resolvedSegment] ?? { main: [], bottom: [] }
  const moduleWithWorkspace = resolvedSegment !== 'Business Owner'

  const bmWorkspaceItems = branchManagerWorkspaceItems(session?.branchId)

  let mainItems: NavItem[]
  if (isOwner) {
    if (resolvedSegment === 'Business Owner') {
      mainItems = ownerWorkspaceItems
    } else {
      const moduleLabel = MODULE_SECTION_LABELS[resolvedSegment] ?? resolvedSegment
      const moduleItems = config.main.filter((item) => item.section !== 'My Workspace')
      const labeledModuleItems = moduleItems.map((item) => ({ ...item, section: moduleLabel }))
      mainItems = [...labeledModuleItems, ...ownerWorkspaceItems]
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
    if (!item.requiredPermission) return true
    const required = Array.isArray(item.requiredPermission)
      ? item.requiredPermission
      : [item.requiredPermission]
    return required.some((p) => hasPermission(session, p))
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
