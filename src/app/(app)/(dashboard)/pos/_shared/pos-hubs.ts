import {
  Banknote,
  BarChart3,
  BookmarkCheck,
  Calculator,
  ClipboardCheck,
  ClipboardList,
  ClipboardX,
  Clock,
  Coins,
  CreditCard,
  Gift,
  Key,
  LayoutDashboard,
  Monitor,
  PackageCheck,
  PauseCircle,
  ReceiptText,
  Settings as SettingsIcon,
  ShieldCheck,
  ShoppingCart,
  Star,
  Tag,
  Undo2,
  Upload,
  Wallet,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import { CREDIT_PERMISSIONS } from '@/src/libs/guards/credit-permissions'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { POS_PERMISSIONS } from '@/src/libs/guards/pos-permissions'
import { can, canManagePosSettings, type SessionUser } from '@/src/libs/guards/permission'

/**
 * POS's sidebar hubs — six groups, named and ordered as the client's "Proposed
 * Point of Sales Tab revision" has them. Each group is one sidebar item; its
 * pages are tabs in the POS top bar.
 *
 * The tabs are the existing routes, not a page that embeds them: every link,
 * redirect and detail route that already points at one keeps working. PosNav
 * renders the strip for whichever hub owns the current path.
 *
 * Product Catalog and Customers are not in any hub — they are their own sidebar
 * rows (SideBar.tsx), a deliberate departure from the revision.
 *
 * A tab can front a second row (`subTabs`): Management is Sessions | Cash Drawer
 * and Promotions is Promo Codes | Gift Cards | Loyalty — one tab in the doc, but
 * several pages in the app. The tab links to its first page the caller can open.
 *
 * A hub whose first tab depends on who is asking has an `entryHref` with no page
 * of its own — it redirects to the first tab the caller can open
 * (pos-hub-entry.ts). Sales Counter points `entryHref` at its first tab.
 */
export type PosSubTab = {
  id: string
  label: string
  href: string
  icon: LucideIcon
  /** Holding any one of these shows the page. Empty means no requirement. */
  permissions: string[]
  /** The shared POS branch switcher sits beside this page's tabs. */
  branchSwitcher?: boolean
}

export type PosHubTab = {
  id: string
  label: string
  /** For a tab with `subTabs`, its first page — what the tab owns, not always where it links. */
  href: string
  icon: LucideIcon
  /**
   * Holding any one of these shows the tab. Empty means no requirement: the
   * Sales Counter tabs were never gated individually and are left as they were —
   * the hub's own `permission` still gates the sidebar item. Ignored when the tab
   * has `subTabs`, which are gated page by page (see posTabPermissions).
   */
  permissions: string[]
  /**
   * Other paths that belong to this tab — its detail and upload pages — so the
   * strip stays put on them. A path that is neither `href` nor under one of
   * these shows no strip, which is how forms and detail pages stay uncluttered.
   */
  prefixes?: string[]
  /** The pages that sit under this tab as a second row of tabs. */
  subTabs?: ReadonlyArray<PosSubTab>
  /** The shared POS branch switcher sits beside this tab's strip. */
  branchSwitcher?: boolean
  /** Business Owner / Branch Manager only — hidden from everyone else (e.g. Cashier). */
  configOnly?: boolean
}

export type PosHub = {
  entryHref: string
  tabs: ReadonlyArray<PosHubTab>
  /**
   * The sidebar item's gate, when it must differ from "any tab's permission" —
   * i.e. the hub's tabs are ungated, or its entry route is a real page that
   * would 403 for someone who holds only a later tab.
   */
  permission?: string[]
  /**
   * How the sidebar item lights up. `prefix` (default) lights on every tab's
   * route and everything under it; `exact` only on the tabs' own routes —
   * Sales Counter, whose Overview tab lives at /pos and would otherwise match
   * the whole module.
   */
  activeMatch?: 'prefix' | 'exact'
}

export const SALES_COUNTER_HUB: PosHub = {
  entryHref: '/pos',
  activeMatch: 'exact',
  permission: [POS_PERMISSIONS.TRANSACTIONS_READ],
  tabs: [
    {
      id: 'overview',
      label: 'Overview',
      href: '/pos',
      icon: LayoutDashboard,
      permissions: [],
      branchSwitcher: true,
    },
    {
      id: 'checkout',
      label: 'Checkout',
      href: '/pos/checkout',
      icon: ShoppingCart,
      permissions: [],
      branchSwitcher: true,
    },
    {
      id: 'reservations',
      label: 'Reservations',
      href: '/pos/reservations',
      icon: BookmarkCheck,
      permissions: [],
      branchSwitcher: true,
    },
    {
      id: 'transactions',
      label: 'Transactions',
      href: '/pos/transactions',
      icon: ReceiptText,
      permissions: [],
      branchSwitcher: true,
    },
    // The page existed but was linked from nowhere — not here, not the
    // sidebar, not checkout — so a cashier could park a sale and then had
    // no way back to it except by typing the URL.
    {
      id: 'parked-sales',
      label: 'Parked Sales',
      href: '/pos/parked-sales',
      icon: PauseCircle,
      permissions: [],
      branchSwitcher: true,
    },
  ],
}

export const PRICING_PROMOTION_HUB: PosHub = {
  entryHref: '/pos/pricing-promotion',
  tabs: [
    {
      id: 'promotions',
      label: 'Promotions',
      href: '/pos/promo-codes',
      icon: Tag,
      permissions: [],
      subTabs: [
        {
          id: 'promo-codes',
          label: 'Promo Codes',
          href: '/pos/promo-codes',
          icon: Tag,
          permissions: [POS_PERMISSIONS.PROMO_CODES_READ],
          branchSwitcher: true,
        },
        {
          id: 'gift-cards',
          label: 'Gift Cards',
          href: '/pos/gift-cards',
          icon: Gift,
          permissions: [POS_PERMISSIONS.GIFT_CARDS_READ],
          branchSwitcher: true,
        },
        {
          id: 'loyalty',
          label: 'Loyalty',
          href: '/pos/loyalty',
          icon: Star,
          permissions: [POS_PERMISSIONS.LOYALTY_READ],
          branchSwitcher: true,
        },
      ],
    },
    {
      // Moved here from CRM's Installment Accounts "Price checker" (it was a
      // modal there). A quoting tool for whoever is selling, so it is gated like
      // the rest of the sales counter, and the endpoint holds the same one.
      id: 'price-maker',
      label: 'Price Maker',
      href: '/pos/price-maker',
      icon: Calculator,
      permissions: [POS_PERMISSIONS.TRANSACTIONS_READ],
    },
  ],
}

// Money at the counter, in the doc's order. Each page keeps its own permission, so
// the cashier closing the shift, a Branch Manager and a Credit Investigator each
// see the tabs they can open and the row shows when any one is held.
export const CASH_COLLECTIONS_HUB: PosHub = {
  entryHref: '/pos/cash-collections',
  tabs: [
    {
      id: 'management',
      label: 'Management',
      href: '/pos/sessions',
      icon: Monitor,
      permissions: [],
      subTabs: [
        {
          id: 'sessions',
          label: 'Sessions',
          href: '/pos/sessions',
          icon: Clock,
          permissions: [POS_PERMISSIONS.SESSIONS_READ],
          branchSwitcher: true,
        },
        {
          id: 'cash-drawer',
          label: 'Cash Drawer',
          href: '/pos/cash-drawer',
          icon: Wallet,
          permissions: [POS_PERMISSIONS.CASH_DRAWER_READ],
          branchSwitcher: true,
        },
      ],
    },
    {
      // Scenario 57 — money received with no customer/invoice behind it (a
      // walk-in payment, a refund). Same permission as Collections since it is
      // the same "money received at the counter" capability. Its new / view /
      // import pages show no strip.
      id: 'new-receipts',
      label: 'New Receipts',
      href: '/pos/collections/acknowledgement',
      icon: ReceiptText,
      permissions: [POS_PERMISSIONS.COLLECTIONS_MANAGE],
    },
    {
      // pos:application:view — credit was folded into the pos module (Scenario
      // 22, 2026-08-08). A Credit Investigator holds only this narrow slice of
      // pos:* (no sessions/transactions/etc.) and still needs their own way into
      // this page. The strip shows on the list only; an application's own page
      // ([id], new) has none.
      id: 'credit-applications',
      label: 'Credit Applications',
      href: '/pos/credit-applications',
      icon: CreditCard,
      permissions: [CREDIT_PERMISSIONS.APPLICATION_VIEW],
    },
    {
      id: 'collections',
      label: 'Collections',
      href: '/pos/collections',
      icon: Coins,
      permissions: [POS_PERMISSIONS.COLLECTIONS_MANAGE],
    },
    {
      // Collected Funds History (client, 2026-10-26), formerly Undeposited
      // Funds; the route, id and permissions keep their old names. Accounting
      // keeps the Cash-in-Transit name for the GL account it reconciles against.
      id: 'undeposited-funds',
      label: 'Collected Funds History',
      href: '/pos/undeposited-funds',
      icon: Banknote,
      permissions: [POS_PERMISSIONS.CASH_IN_TRANSIT_READ],
    },
  ],
}

// The manager queues, in the doc's order. Each tab's permission matches its page's
// own guard, so a Cashier (who holds transactions:read but not the override
// permission) sees Unit Release Approvals and Void Requests and nothing that
// would 403.
export const APPROVALS_REVIEWS_HUB: PosHub = {
  entryHref: '/pos/approvals',
  tabs: [
    {
      // Scenario 71 Part 4 — the end-of-day look at every price override, typed
      // term and waiver. Carries the pending-entry badge (see PosNav and
      // SideBar). Its page has its own branch selector.
      id: 'override-review',
      label: 'Override Review',
      href: '/pos/override-review',
      icon: ClipboardCheck,
      permissions: [POS_PERMISSIONS.TRANSACTIONS_OVERRIDE],
    },
    {
      // Was "Release Approvals". Cashiers can view (not approve) their own
      // submitted requests here.
      id: 'unit-release-approvals',
      label: 'Unit Release Approvals',
      href: '/pos/release-approvals',
      icon: PackageCheck,
      permissions: [POS_PERMISSIONS.TRANSACTIONS_READ],
    },
    {
      id: 'refund-approvals',
      label: 'Refund Approvals',
      href: '/pos/return-refund-approvals',
      icon: Undo2,
      permissions: [POS_PERMISSIONS.TRANSACTIONS_OVERRIDE],
    },
    {
      id: 'void-requests',
      label: 'Void Requests',
      href: '/pos/void-requests',
      icon: ShieldCheck,
      permissions: [POS_PERMISSIONS.TRANSACTIONS_READ],
    },
    {
      id: 'cancellations',
      label: 'Cancellations',
      href: '/pos/cancellation-requests',
      icon: ClipboardX,
      permissions: [POS_PERMISSIONS.TRANSACTIONS_OVERRIDE],
    },
  ],
}

export const REPORTS_HUB: PosHub = {
  entryHref: '/pos/reporting',
  tabs: [
    {
      // Scenario 47 — gated like the page (pos:reports:read), deliberately not
      // pos:transactions:read: these reports expose unit cost and margin, so a
      // Cashier must not even see the tab.
      id: 'sales-reports',
      label: 'Sales Reports',
      href: '/pos/reports',
      icon: BarChart3,
      permissions: [POS_PERMISSIONS.REPORTS_READ],
    },
    {
      // Scenario 53 — the client's own end-of-day document. Its own permission,
      // so the cashier who closes the shift can print and sign it without the
      // Branch-Manager-tier sales reports coming with it. Its page has its own
      // branch selector.
      id: 'daily-collection',
      label: 'Daily Collection',
      href: '/pos/daily-collection',
      icon: ClipboardList,
      permissions: [POS_PERMISSIONS.DAILY_COLLECTION_READ],
    },
  ],
}

export const OPERATIONS_ADMIN_HUB: PosHub = {
  entryHref: '/pos/admin',
  tabs: [
    {
      id: 'service-jobs',
      label: 'Service Jobs',
      href: '/pos/service-jobs',
      icon: Wrench,
      permissions: [POS_PERMISSIONS.SERVICE_DRAFTS_READ],
    },
    {
      // Was "Price Lists". The price-list manager — lists, versions, approval and
      // the uploads — which moved here from Inventory, so it keeps that module's
      // permission. Its list, detail and upload pages all keep the strip.
      id: 'price-list-upload',
      label: 'Price List Upload',
      href: '/pos/catalog/price-lists',
      icon: Upload,
      permissions: [INVENTORY_PERMISSIONS.PRICE_LISTS_READ],
      prefixes: ['/pos/catalog/price-lists/'],
    },
    {
      // Every POS role needs their own PIN (checkout PIN entry, manager
      // approvals), so it has no permission — and so the row shows for any POS
      // role, including a Credit Investigator.
      id: 'pos-pin',
      label: 'POS PIN',
      href: '/pos/pin',
      icon: Key,
      permissions: [],
    },
    {
      // Business Owner or Branch Manager only — the layout's guard is
      // role-based (canManagePosSettings), not permission-based, and Cashier
      // holds pos:config:manage too, so a permission here would show them a
      // tab that redirects to /403. `configOnly` is that role check. Every
      // /pos/settings/* page shows the strip, over its own left-rail tabs.
      id: 'settings',
      label: 'Settings',
      href: '/pos/settings',
      icon: SettingsIcon,
      permissions: [],
      prefixes: ['/pos/settings/'],
      configOnly: true,
    },
  ],
}

export const POS_HUBS: ReadonlyArray<PosHub> = [
  SALES_COUNTER_HUB,
  PRICING_PROMOTION_HUB,
  CASH_COLLECTIONS_HUB,
  APPROVALS_REVIEWS_HUB,
  REPORTS_HUB,
  OPERATIONS_ADMIN_HUB,
]

/**
 * Pages that are not part of any hub but still read the POS branch the switcher
 * sets. They show the switcher with no tab strip beside it.
 */
const POS_BRANCH_SWITCHER_ONLY_PATHS = ['/pos/catalog']

/** Every route a hub's tabs link to, second-row pages included. */
export function posHubHrefs(hub: PosHub): string[] {
  return hub.tabs.flatMap((tab) => (tab.subTabs ? tab.subTabs.map((s) => s.href) : [tab.href]))
}

/**
 * The permissions that show a tab: its own, or — for a tab that fronts a second
 * row — any one of its pages'. Empty means the tab has no requirement.
 */
export function posTabPermissions(tab: PosHubTab): string[] {
  if (!tab.subTabs) return tab.permissions
  if (tab.subTabs.some((s) => s.permissions.length === 0)) return []
  return tab.subTabs.flatMap((s) => s.permissions)
}

function tabOwnsPath(tab: PosHubTab, pathname: string): boolean {
  return (
    pathname === tab.href ||
    (tab.prefixes?.some((p) => pathname.startsWith(p)) ?? false) ||
    (tab.subTabs?.some((s) => s.href === pathname) ?? false)
  )
}

/** The hub whose strip belongs on `pathname`, if any. */
export function findPosHubForPath(pathname: string): PosHub | undefined {
  return POS_HUBS.find((hub) => hub.tabs.some((tab) => tabOwnsPath(tab, pathname)))
}

/** Whether `tab` is the one lit on `pathname`. */
export function isPosTabActive(tab: PosHubTab, pathname: string): boolean {
  return tabOwnsPath(tab, pathname)
}

/**
 * Where a tab links for a caller who may open `visibleHrefs`: its own route, or —
 * for a tab fronting a second row — the first page of that row they can open.
 * null when they can open none of it.
 */
export function resolvePosTabHref(tab: PosHubTab, visibleHrefs: string[]): string | null {
  if (tab.subTabs) return tab.subTabs.find((s) => visibleHrefs.includes(s.href))?.href ?? null
  return visibleHrefs.includes(tab.href) ? tab.href : null
}

/**
 * What PosNav draws on `pathname`: the hub's tabs the caller may open, the lit
 * one, and the second row under it. null on a page no hub owns.
 */
export function posNavModel(pathname: string, visibleHrefs: string[], canConfigurePos: boolean) {
  const hub = findPosHubForPath(pathname)
  if (!hub) return null
  const tabs = hub.tabs.filter(
    (tab) => (canConfigurePos || !tab.configOnly) && resolvePosTabHref(tab, visibleHrefs) !== null
  )
  const activeTab = tabs.find((tab) => tabOwnsPath(tab, pathname))
  const subTabs = activeTab?.subTabs?.filter((s) => visibleHrefs.includes(s.href)) ?? []
  return { tabs, activeTab, subTabs }
}

/**
 * Whether the shared branch switcher belongs in the top bar on `pathname`. Routes
 * without a tab flagged for it either surface the switcher inline with their own
 * page title (/pos/settings/*, Override Review, Daily Collection) or have
 * nothing branch-scoped on the page (/pos/pin).
 */
export function showsPosBranchSwitcher(pathname: string): boolean {
  if (POS_BRANCH_SWITCHER_ONLY_PATHS.includes(pathname)) return true
  return POS_HUBS.some((hub) =>
    hub.tabs.some((tab) =>
      tab.subTabs
        ? tab.subTabs.some((s) => s.branchSwitcher && s.href === pathname)
        : tab.branchSwitcher && pathname === tab.href
    )
  )
}

function holdsAny(session: SessionUser, permissions: string[]): boolean {
  return permissions.length === 0 || permissions.some((p) => can(session, p))
}

/** Hrefs of every hub page the caller may open — what PosNav is allowed to draw. */
export function visiblePosTabHrefs(session: SessionUser | null): string[] {
  if (!session) return []
  const configurable = canManagePosSettings(session)
  return POS_HUBS.flatMap((hub) => hub.tabs).flatMap((tab) => {
    if (tab.configOnly && !configurable) return []
    if (tab.subTabs) {
      return tab.subTabs.filter((s) => holdsAny(session, s.permissions)).map((s) => s.href)
    }
    return holdsAny(session, tab.permissions) ? [tab.href] : []
  })
}
