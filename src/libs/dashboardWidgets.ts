// Central widget registry for the customizable dashboard.
// Defines all available widgets, their default sizes, and role-based defaults.

export type DashboardRole = 'admin' | 'hr' | 'accounting' | 'inventory' | 'sales' | 'default'

export type WidgetDef = {
  id: string
  label: string
  emoji: string
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
      'add-employee',
      'new-invoice',
      'run-payroll',
      'view-reports',
      'leave-calendar',
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
    emoji: '📊',
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
    emoji: '🗂️',
    description: 'Module overview cards',
    defaultW: 12,
    defaultH: 3,
    minW: 5,
    minH: 3,
    roles: ['admin'],
  },
  {
    id: 'weather',
    label: 'Weather',
    emoji: '⛅',
    description: 'Current weather conditions',
    defaultW: 3,
    defaultH: 3,
    minW: 2,
    minH: 3,
    roles: ['admin', 'hr', 'accounting', 'inventory', 'default'],
  },
  {
    id: 'events',
    label: 'Events & Projects',
    emoji: '📅',
    description: 'Upcoming events and project milestones',
    defaultW: 6,
    defaultH: 3,
    minW: 3,
    minH: 3,
    roles: ['admin', 'hr', 'accounting', 'inventory', 'default'],
  },
  {
    id: 'memo-advisory',
    label: 'Memo & Advisory',
    emoji: '📋',
    description: 'Company memos and advisories',
    defaultW: 6,
    defaultH: 3,
    minW: 3,
    minH: 3,
    roles: ['admin', 'hr', 'accounting', 'inventory', 'default'],
  },
  {
    id: 'pending-requests',
    label: 'Pending Requests',
    emoji: '⏳',
    description: 'Items awaiting your action',
    defaultW: 4,
    defaultH: 3,
    minW: 3,
    minH: 3,
    roles: ['admin', 'hr', 'accounting', 'inventory'],
  },
  {
    id: 'announcements',
    label: 'Announcements',
    emoji: '📢',
    description: 'Company-wide announcements',
    defaultW: 6,
    defaultH: 3,
    minW: 3,
    minH: 3,
    roles: ['admin', 'hr', 'accounting', 'inventory', 'default'],
  },
  {
    id: 'reminders',
    label: 'Reminders',
    emoji: '🔔',
    description: 'Your upcoming reminders',
    defaultW: 3,
    defaultH: 3,
    minW: 2,
    minH: 3,
    roles: ['admin', 'hr', 'accounting', 'inventory', 'default'],
  },
  {
    id: 'attendance-summary',
    label: 'Attendance Summary',
    emoji: '🕐',
    description: 'Team attendance statistics',
    defaultW: 6,
    defaultH: 3,
    minW: 4,
    minH: 3,
    roles: ['admin', 'hr'],
  },
  {
    id: 'leave-requests',
    label: 'Leave Requests',
    emoji: '🏖️',
    description: 'Recent leave requests and status',
    defaultW: 6,
    defaultH: 3,
    minW: 4,
    minH: 3,
    roles: ['admin', 'hr'],
  },
  {
    id: 'overtime-requests',
    label: 'Overtime Requests',
    emoji: '⏰',
    description: 'Overtime request approvals',
    defaultW: 4,
    defaultH: 3,
    minW: 3,
    minH: 3,
    roles: ['admin', 'hr'],
  },
  {
    id: 'payroll-summary',
    label: 'Payroll Summary',
    emoji: '💰',
    description: 'Current payroll period overview',
    defaultW: 6,
    defaultH: 3,
    minW: 4,
    minH: 3,
    roles: ['admin', 'hr', 'accounting'],
  },
  {
    id: 'payslip-status',
    label: 'Payslip Status',
    emoji: '🧾',
    description: 'Payslip generation and distribution status',
    defaultW: 6,
    defaultH: 3,
    minW: 4,
    minH: 3,
    roles: ['admin', 'hr', 'accounting'],
  },
  {
    id: 'employee-birthdays',
    label: 'Employee Birthdays',
    emoji: '🎂',
    description: 'Team birthdays this month',
    defaultW: 4,
    defaultH: 3,
    minW: 3,
    minH: 3,
    roles: ['admin', 'hr'],
  },
  {
    id: 'recent-activity',
    label: 'Recent Activity',
    emoji: '🕒',
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
    emoji: '⚡',
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
    emoji: '⚠️',
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
    emoji: '✅',
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
    emoji: '📆',
    description: 'Monthly calendar view',
    defaultW: 6,
    defaultH: 7,
    minW: 4,
    minH: 5,
    roles: ['admin', 'hr', 'accounting', 'inventory', 'default'],
  },
  {
    id: 'department-summary',
    label: 'Department Summary',
    emoji: '🏢',
    description: 'Department headcount and metrics',
    defaultW: 6,
    defaultH: 3,
    minW: 4,
    minH: 3,
    roles: ['admin', 'hr'],
  },
  // ── Sales & Orders widgets ──────────────────────────────────────────────────
  {
    id: 'sales-stats',
    label: 'Sales Overview',
    emoji: '🛒',
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
    emoji: '📈',
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
    emoji: '🏆',
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
    emoji: '📦',
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
    emoji: '🧾',
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
    emoji: '🚚',
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
    emoji: '🏪',
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
    emoji: '🏢',
    description: 'Employee count, users, pending leave, active modules',
    defaultW: 12,
    defaultH: 3,
    minW: 6,
    minH: 2,
    roles: ['admin'],
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
  admin: ['stats', 'modules', 'recent-activity', 'quick-actions', 'system-alerts'],
  hr: ['stats', 'attendance-summary', 'leave-requests', 'payroll-summary', 'employee-birthdays'],
  accounting: ['stats', 'payroll-summary', 'payslip-status', 'pending-requests', 'recent-activity'],
  inventory: ['stats', 'task-overview', 'recent-activity', 'quick-actions', 'system-alerts'],
  sales: [
    'sales-stats',
    'sales-trend',
    'top-customers',
    'recent-orders',
    'outstanding-invoices',
    'pending-deliveries',
  ],
  default: ['announcements', 'events', 'pending-requests', 'reminders'],
}

// ── Default grid layouts per role ─────────────────────────────────────────────

export const defaultLayoutsByRole: Record<DashboardRole, LayoutItem[]> = {
  admin: [
    { i: 'stats', x: 0, y: 0, w: 12, h: 3, minW: 4, minH: 3 },
    { i: 'modules', x: 0, y: 3, w: 12, h: 3, minW: 5, minH: 3 },
    { i: 'recent-activity', x: 0, y: 6, w: 6, h: 3, minW: 3, minH: 3 },
    { i: 'quick-actions', x: 6, y: 6, w: 3, h: 3, minW: 2, minH: 3 },
    { i: 'system-alerts', x: 9, y: 6, w: 3, h: 3, minW: 3, minH: 3 },
  ],
  hr: [
    { i: 'stats', x: 0, y: 0, w: 12, h: 3, minW: 4, minH: 3 },
    { i: 'attendance-summary', x: 0, y: 3, w: 6, h: 3, minW: 4, minH: 3 },
    { i: 'leave-requests', x: 6, y: 3, w: 6, h: 3, minW: 4, minH: 3 },
    { i: 'payroll-summary', x: 0, y: 6, w: 6, h: 3, minW: 4, minH: 3 },
    { i: 'employee-birthdays', x: 6, y: 6, w: 6, h: 3, minW: 3, minH: 3 },
  ],
  accounting: [
    { i: 'stats', x: 0, y: 0, w: 12, h: 3, minW: 4, minH: 3 },
    { i: 'payroll-summary', x: 0, y: 3, w: 6, h: 3, minW: 4, minH: 3 },
    { i: 'payslip-status', x: 6, y: 3, w: 6, h: 3, minW: 4, minH: 3 },
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
    { i: 'announcements', x: 0, y: 0, w: 6, h: 3, minW: 3, minH: 3 },
    { i: 'events', x: 6, y: 0, w: 6, h: 3, minW: 3, minH: 3 },
    { i: 'pending-requests', x: 0, y: 3, w: 4, h: 3, minW: 3, minH: 3 },
    { i: 'reminders', x: 4, y: 3, w: 4, h: 3, minW: 2, minH: 3 },
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
