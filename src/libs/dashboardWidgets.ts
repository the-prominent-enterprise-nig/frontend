// Central widget registry for the customizable dashboard.
// Defines all available widgets, their default sizes, and role-based defaults.

import type { LucideIcon } from 'lucide-react'
import {
  BarChart2,
  LayoutGrid,
  Clock,
  Bell,
  Gift,
  Activity,
  Zap,
  AlertTriangle,
  ListChecks,
  Calendar,
  ShoppingCart,
  TrendingUp,
  Trophy,
  Package,
  FileWarning,
  Truck,
  Store,
  Building,
  Layers,
  ClipboardList,
  Calculator,
} from 'lucide-react'

export type DashboardRole = 'admin' | 'hr' | 'accounting' | 'inventory' | 'sales' | 'default'

export type WidgetDef = {
  id: string
  label: string
  icon: LucideIcon
  description: string
  defaultW: number
  defaultH: number
  minW: number
  minH: number
  roles: DashboardRole[]
}

// Grid layout item — compatible with react-grid-layout's Layout type.
export type LayoutItem = {
  i: string
  x: number
  y: number
  w: number
  h: number
  minW?: number
  minH?: number
}

export type SavedDashboardState = {
  visibleWidgets: string[]
  layout: LayoutItem[]
  /** Per-widget configuration saved across sessions (optional for backward compat). */
  widgetSettings?: Record<string, Record<string, unknown>>
}

// ── Widget settings ───────────────────────────────────────────────────────────

/** Settings shape for the Quick Actions widget. */
export type QuickActionsSettings = {
  enabledActions: string[]
}

/**
 * Default per-widget settings used on first load and after "Reset Layout".
 * Only widgets listed here show a settings icon in edit mode.
 */
export const DEFAULT_WIDGET_SETTINGS: Record<string, Record<string, unknown>> = {
  'quick-actions': {
    enabledActions: [
      'new-sale',
      'new-invoice',
      'add-customer',
      'view-reports',
      'stock-receive',
      'settings',
    ],
  } satisfies QuickActionsSettings,
}

/** Widget IDs that expose a customisation panel in edit mode. */
export const CONFIGURABLE_WIDGET_IDS: ReadonlySet<string> = new Set(['quick-actions'])

// ── Widget definitions ────────────────────────────────────────────────────────

export const ALL_WIDGETS: WidgetDef[] = [
  {
    id: 'stats',
    label: 'Stats Overview',
    icon: BarChart2,
    description: 'Key metrics at a glance',
    defaultW: 12,
    defaultH: 3,
    minW: 4,
    minH: 3,
    roles: ['admin', 'hr', 'accounting', 'inventory'],
  },
  {
    id: 'modules',
    label: 'Modules',
    icon: LayoutGrid,
    description: 'Module overview cards',
    defaultW: 12,
    defaultH: 3,
    minW: 5,
    minH: 3,
    roles: ['admin'],
  },
  {
    id: 'pending-requests',
    label: 'Pending Requests',
    icon: Clock,
    description: 'Items awaiting your action',
    defaultW: 4,
    defaultH: 3,
    minW: 3,
    minH: 3,
    roles: ['admin', 'hr', 'accounting', 'inventory'],
  },
  {
    id: 'reminders',
    label: 'Reminders',
    icon: Bell,
    description: 'Your upcoming reminders',
    defaultW: 3,
    defaultH: 3,
    minW: 2,
    minH: 3,
    roles: ['admin', 'hr', 'accounting', 'inventory', 'default'],
  },
  {
    id: 'employee-birthdays',
    label: 'Employee Birthdays',
    icon: Gift,
    description: 'Upcoming birthdays from the Calendar',
    defaultW: 4,
    defaultH: 3,
    minW: 3,
    minH: 3,
    roles: ['admin', 'accounting', 'inventory', 'default'],
  },
  {
    id: 'recent-activity',
    label: 'Recent Activity',
    icon: Activity,
    description: 'Latest system activity',
    defaultW: 6,
    defaultH: 3,
    minW: 3,
    minH: 3,
    roles: ['admin', 'hr', 'accounting', 'inventory'],
  },
  {
    id: 'quick-actions',
    label: 'Quick Actions',
    icon: Zap,
    description: 'Frequent shortcuts',
    defaultW: 3,
    defaultH: 3,
    minW: 2,
    minH: 3,
    roles: ['admin', 'hr', 'accounting', 'inventory', 'default'],
  },
  {
    id: 'system-alerts',
    label: 'System Alerts',
    icon: AlertTriangle,
    description: 'System and operational alerts',
    defaultW: 4,
    defaultH: 3,
    minW: 3,
    minH: 3,
    roles: ['admin'],
  },
  {
    id: 'task-overview',
    label: 'Task Overview',
    icon: ListChecks,
    description: 'Task completion and progress',
    defaultW: 6,
    defaultH: 3,
    minW: 4,
    minH: 3,
    roles: ['admin', 'hr', 'accounting', 'inventory'],
  },
  {
    id: 'calendar',
    label: 'Calendar',
    icon: Calendar,
    description: 'Monthly calendar view',
    defaultW: 6,
    defaultH: 5,
    minW: 4,
    minH: 3,
    roles: ['admin', 'hr', 'accounting', 'inventory', 'default'],
  },
  // ── Sales & Orders widgets ──────────────────────────────────────────────────
  {
    id: 'sales-stats',
    label: 'Sales Overview',
    icon: ShoppingCart,
    description: 'Total sales, revenue, and order metrics',
    defaultW: 12,
    defaultH: 3,
    minW: 4,
    minH: 3,
    roles: ['admin', 'sales'],
  },
  {
    id: 'sales-trend',
    label: 'Sales Trend',
    icon: TrendingUp,
    description: 'Monthly revenue trend',
    defaultW: 6,
    defaultH: 4,
    minW: 4,
    minH: 3,
    roles: ['admin', 'sales'],
  },
  {
    id: 'top-customers',
    label: 'Top Customers',
    icon: Trophy,
    description: 'Highest-revenue customers this period',
    defaultW: 6,
    defaultH: 4,
    minW: 3,
    minH: 3,
    roles: ['admin', 'sales'],
  },
  {
    id: 'recent-orders',
    label: 'Recent Orders',
    icon: Package,
    description: 'Latest sales orders and status',
    defaultW: 6,
    defaultH: 4,
    minW: 3,
    minH: 3,
    roles: ['admin', 'sales'],
  },
  {
    id: 'outstanding-invoices',
    label: 'Outstanding Invoices',
    icon: FileWarning,
    description: 'Unpaid and overdue invoices',
    defaultW: 6,
    defaultH: 3,
    minW: 3,
    minH: 3,
    roles: ['admin', 'sales', 'accounting'],
  },
  {
    id: 'pending-deliveries',
    label: 'Pending Deliveries',
    icon: Truck,
    description: 'Orders awaiting dispatch or delivery',
    defaultW: 6,
    defaultH: 3,
    minW: 3,
    minH: 3,
    roles: ['admin', 'sales'],
  },
  {
    id: 'sales-by-branch',
    label: 'Sales by Branch',
    icon: Store,
    description: 'Revenue breakdown per branch',
    defaultW: 6,
    defaultH: 3,
    minW: 3,
    minH: 3,
    roles: ['admin', 'sales'],
  },
  {
    id: 'enterprise-summary',
    label: 'Enterprise Summary',
    icon: Building,
    description: 'Employee and user counts',
    defaultW: 12,
    defaultH: 3,
    minW: 6,
    minH: 2,
    roles: ['admin'],
  },
  {
    id: 'module-stats',
    label: 'Module Stats',
    icon: Layers,
    description: 'Key metrics across POS, Inventory, Accounting, and CRM',
    defaultW: 12,
    defaultH: 4,
    minW: 6,
    minH: 3,
    roles: ['admin'],
  },
  {
    id: 'pending-approvals',
    label: 'Pending Approvals',
    icon: ClipboardList,
    description: 'POs, voids, refunds, and transfers awaiting your approval',
    defaultW: 6,
    defaultH: 4,
    minW: 3,
    minH: 3,
    roles: ['admin'],
  },
  {
    id: 'cogs-gaps',
    label: 'COGS Posting Gaps',
    icon: Calculator,
    description: 'Completed sales that never got a COGS/Inventory posting',
    defaultW: 6,
    defaultH: 3,
    minW: 3,
    minH: 3,
    roles: ['admin', 'accounting'],
  },
]

export const widgetById: Record<string, WidgetDef> = Object.fromEntries(
  ALL_WIDGETS.map((w) => [w.id, w])
)

// ── Grid layout constants ─────────────────────────────────────────────────────

export const GRID_ROW_HEIGHT = 64
export const GRID_MARGIN_Y = 12

/**
 * Converts a measured natural content-area height (px) into a grid row count.
 * Accounts for the widget header, inner padding, and row-height formula.
 *   outerHeight = h * (ROW_HEIGHT + MARGIN_Y) - MARGIN_Y
 *   → h = ceil((outerHeight + MARGIN_Y) / (ROW_HEIGHT + MARGIN_Y))
 * WIDGET_OVERHEAD covers header (~38px) + p-3 padding top+bottom (24px) + 2px buffer.
 */
const WIDGET_OVERHEAD_PX = 64

export function fitHeightToContent(contentPx: number, minH = 1): number {
  const totalPx = contentPx + WIDGET_OVERHEAD_PX
  const h = Math.ceil((totalPx + GRID_MARGIN_Y) / (GRID_ROW_HEIGHT + GRID_MARGIN_Y))
  return Math.max(h, minH)
}

/**
 * Returns a new layout where each item's `h` is auto-fitted to its measured
 * content height. Items without a measurement are left unchanged.
 */
export function fitLayoutToContent(
  layout: LayoutItem[],
  naturalHeights: Record<string, number>
): LayoutItem[] {
  return layout.map((item) => {
    const contentPx = naturalHeights[item.i]
    if (contentPx == null) return item
    const h = fitHeightToContent(contentPx, item.minH ?? 1)
    return { ...item, h }
  })
}

/**
 * Vertically compacts a layout so there are no empty row gaps between items.
 * Each item is pushed up to the lowest y position where it doesn't collide
 * with already-placed items. Call this after fitLayoutToContent to ensure
 * reduced `h` values don't leave dead space between rows.
 */
export function compactLayoutVertically(layout: LayoutItem[]): LayoutItem[] {
  // Sort by y first, then x for a deterministic top-to-bottom, left-to-right order.
  const sorted = [...layout].sort((a, b) => (a.y !== b.y ? a.y - b.y : a.x - b.x))

  const placed: LayoutItem[] = []

  for (const item of sorted) {
    let y = 0
    while (placed.some((p) => layoutItemsOverlap(p, { ...item, y }))) {
      y++
    }
    placed.push({ ...item, y })
  }

  // Return in original order so callers don't need to re-sort.
  const resultMap = new Map(placed.map((item) => [item.i, item]))
  return layout.map((item) => resultMap.get(item.i) ?? item)
}

function layoutItemsOverlap(a: LayoutItem, b: LayoutItem): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

export const widgetsByRole: Record<DashboardRole, WidgetDef[]> = {
  admin: ALL_WIDGETS.filter((w) => w.roles.includes('admin')),
  hr: ALL_WIDGETS.filter((w) => w.roles.includes('hr')),
  accounting: ALL_WIDGETS.filter((w) => w.roles.includes('accounting')),
  inventory: ALL_WIDGETS.filter((w) => w.roles.includes('inventory')),
  sales: ALL_WIDGETS.filter((w) => w.roles.includes('sales')),
  default: ALL_WIDGETS.filter((w) => w.roles.includes('default')),
}

// ── Default visible widget lists per role ─────────────────────────────────────

export const defaultWidgetsByRole: Record<DashboardRole, string[]> = {
  admin: ['calendar', 'module-stats', 'sales-by-branch', 'pending-approvals', 'recent-activity'],
  hr: ['stats', 'pending-requests', 'recent-activity', 'employee-birthdays', 'calendar'],
  accounting: [
    'stats',
    'outstanding-invoices',
    'pending-approvals',
    'pending-requests',
    'recent-activity',
  ],
  inventory: ['stats', 'task-overview', 'recent-activity', 'quick-actions', 'system-alerts'],
  sales: [
    'sales-stats',
    'sales-trend',
    'top-customers',
    'recent-orders',
    'outstanding-invoices',
    'pending-deliveries',
  ],
  default: ['pending-requests', 'reminders', 'calendar', 'recent-activity'],
}

// ── Default grid layouts per role ─────────────────────────────────────────────

export const defaultLayoutsByRole: Record<DashboardRole, LayoutItem[]> = {
  admin: [
    { i: 'calendar', x: 0, y: 0, w: 12, h: 5, minW: 4, minH: 3 },
    { i: 'module-stats', x: 0, y: 7, w: 12, h: 4, minW: 6, minH: 3 },
    { i: 'sales-by-branch', x: 0, y: 11, w: 6, h: 4, minW: 3, minH: 3 },
    { i: 'pending-approvals', x: 6, y: 11, w: 6, h: 4, minW: 3, minH: 3 },
    { i: 'recent-activity', x: 0, y: 15, w: 12, h: 4, minW: 3, minH: 3 },
  ],
  hr: [
    { i: 'stats', x: 0, y: 0, w: 12, h: 3, minW: 4, minH: 3 },
    { i: 'pending-requests', x: 0, y: 3, w: 6, h: 3, minW: 3, minH: 3 },
    { i: 'recent-activity', x: 6, y: 3, w: 6, h: 3, minW: 3, minH: 3 },
    { i: 'employee-birthdays', x: 0, y: 6, w: 4, h: 3, minW: 3, minH: 3 },
    { i: 'calendar', x: 4, y: 6, w: 8, h: 5, minW: 4, minH: 3 },
  ],
  accounting: [
    { i: 'stats', x: 0, y: 0, w: 12, h: 3, minW: 4, minH: 3 },
    { i: 'outstanding-invoices', x: 0, y: 3, w: 6, h: 3, minW: 4, minH: 3 },
    { i: 'pending-approvals', x: 6, y: 3, w: 6, h: 3, minW: 4, minH: 3 },
    { i: 'pending-requests', x: 0, y: 6, w: 4, h: 3, minW: 3, minH: 3 },
    { i: 'recent-activity', x: 4, y: 6, w: 8, h: 3, minW: 3, minH: 3 },
  ],
  inventory: [
    { i: 'stats', x: 0, y: 0, w: 12, h: 3, minW: 4, minH: 3 },
    { i: 'task-overview', x: 0, y: 3, w: 6, h: 3, minW: 4, minH: 3 },
    { i: 'recent-activity', x: 6, y: 3, w: 6, h: 3, minW: 3, minH: 3 },
    { i: 'quick-actions', x: 0, y: 6, w: 3, h: 3, minW: 2, minH: 3 },
    { i: 'system-alerts', x: 3, y: 6, w: 4, h: 3, minW: 3, minH: 3 },
  ],
  default: [
    { i: 'pending-requests', x: 0, y: 0, w: 6, h: 3, minW: 3, minH: 3 },
    { i: 'reminders', x: 6, y: 0, w: 6, h: 3, minW: 2, minH: 3 },
    { i: 'calendar', x: 0, y: 3, w: 8, h: 5, minW: 4, minH: 3 },
    { i: 'recent-activity', x: 8, y: 3, w: 4, h: 3, minW: 3, minH: 3 },
  ],
  sales: [
    { i: 'sales-stats', x: 0, y: 0, w: 12, h: 3, minW: 4, minH: 3 },
    { i: 'sales-trend', x: 0, y: 3, w: 6, h: 4, minW: 4, minH: 3 },
    { i: 'top-customers', x: 6, y: 3, w: 6, h: 4, minW: 3, minH: 3 },
    { i: 'recent-orders', x: 0, y: 7, w: 7, h: 4, minW: 3, minH: 3 },
    { i: 'outstanding-invoices', x: 7, y: 7, w: 5, h: 3, minW: 3, minH: 3 },
    { i: 'pending-deliveries', x: 7, y: 10, w: 5, h: 3, minW: 3, minH: 3 },
  ],
}

// Build a full layout for a role (all available widgets, with defaults for
// visible ones and stacked positions for the rest).
export function buildFullLayout(role: DashboardRole): LayoutItem[] {
  const defaults = defaultLayoutsByRole[role]
  const defaultMap = new Map(defaults.map((item) => [item.i, item]))
  const roleWidgets = widgetsByRole[role]

  // Start with default items, then append remaining role widgets below.
  let maxY = defaults.reduce((acc, item) => Math.max(acc, item.y + item.h), 0)
  const extra: LayoutItem[] = []

  for (const w of roleWidgets) {
    if (!defaultMap.has(w.id)) {
      extra.push({
        i: w.id,
        x: 0,
        y: maxY,
        w: w.defaultW,
        h: w.defaultH,
        minW: w.minW,
        minH: w.minH,
      })
      maxY += w.defaultH
    }
  }

  return [...defaults, ...extra]
}
