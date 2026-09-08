// Central widget registry for the customizable dashboard.
// Defines all available widgets, their default sizes, and role-based defaults.

import type { LucideIcon } from 'lucide-react'
import {
  BarChart2,
  LayoutGrid,
  Bell,
  Gift,
  Activity,
  Zap,
  AlertTriangle,
  AlertCircle,
  Gauge,
  Calendar,
  ShoppingCart,
  TrendingUp,
  Trophy,
  Package,
  FileWarning,
  Bookmark,
  Store,
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
  /** Skip the standard title bar + content padding in view mode — the
   * widget's own content supplies all chrome. Still shown while editing
   * so the widget stays draggable/removable/configurable. */
  noChrome?: boolean
  /** Opt out of auto-fit-to-content sizing — the widget keeps whatever `h`
   * is in the layout (default or user-dragged) instead of being resized to
   * match its currently-measured natural height. For a widget with more
   * than one internal view whose natural heights differ (e.g. Calendar's
   * grid vs. list view), auto-fitting means switching views reflows every
   * widget below it, which reads as the page jumping around. */
  noAutoFit?: boolean
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
    id: 'kpi-strip',
    label: 'Overview',
    icon: Gauge,
    description:
      'Top-line KPIs at a glance: revenue, outstanding AR, needs-attention count, customers, employees, and system users',
    defaultW: 12,
    defaultH: 3,
    minW: 6,
    minH: 2,
    roles: ['admin'],
    // noChrome: the widget renders its own unboxed heading (see
    // HeroKpiStripWidget) — the standard wrapper card would put a bordered
    // background around content that's already 4 individually-bordered
    // tiles, reading as boxes nested in a box.
    noChrome: true,
  },
  {
    id: 'stats',
    label: 'Stats Overview',
    icon: BarChart2,
    description: 'Key metrics at a glance',
    defaultW: 12,
    defaultH: 3,
    minW: 4,
    minH: 3.5,
    // 'admin' deliberately excluded — superseded by kpi-strip (Overview),
    // which covers the same "top KPI strip" role for the Business Owner
    // dashboard; having both would just be two competing summaries.
    roles: ['hr', 'accounting', 'inventory'],
  },
  {
    id: 'modules',
    label: 'Modules',
    icon: LayoutGrid,
    description: 'Module overview cards',
    defaultW: 12,
    defaultH: 3,
    minW: 5,
    minH: 3.5,
    // 'admin' deliberately excluded — duplicates the sidebar nav and
    // module-stats; a leftover from before module-stats existed.
    roles: [],
  },
  // Not registered: Leave/Overtime counts call the same dead HR endpoints
  // (/leave-management/summary, /attendance/overtime-requests) as the HR
  // widgets above — no HR backend module exists. Its other two fields
  // ("Document Requests"/"Flagged Items") were always hardcoded to 0 with a
  // "Soon" label — no backend concept for either exists yet, so there's
  // nothing real to wire even once HR exists. Uncomment once both are
  // resolved (also re-add Clock to the lucide-react import above, and this
  // id back into EditableDashboard.tsx + the hr/accounting/inventory/default
  // role defaults below).
  // {
  //   id: 'pending-requests',
  //   label: 'Pending Requests',
  //   icon: Clock,
  //   description: 'Items awaiting your action',
  //   defaultW: 4,
  //   defaultH: 3,
  //   minW: 3,
  //   minH: 3.5,
  //   roles: ['admin', 'hr', 'accounting', 'inventory'],
  // },
  {
    id: 'reminders',
    label: 'Reminders',
    icon: Bell,
    description: 'Your upcoming reminders',
    defaultW: 4,
    defaultH: 3,
    minW: 3,
    minH: 3.5,
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
    minH: 3.5,
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
    minH: 3.5,
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
    minH: 3.5,
    // 'admin' deliberately excluded — these are cashier/staff shortcuts
    // (new sale, stock receive), not something a Business Owner adds to a
    // strategic overview dashboard.
    roles: ['hr', 'accounting', 'inventory', 'default'],
  },
  {
    id: 'system-alerts',
    label: 'System Alerts',
    icon: AlertTriangle,
    description: 'System and operational alerts',
    defaultW: 4,
    defaultH: 3,
    minW: 3,
    minH: 3.5,
    roles: ['admin'],
  },
  // Not registered: no Task concept exists anywhere in the backend (no
  // model, no controller) — this was pure hardcoded mock with nothing real
  // to wire. Uncomment once a real Task backend feature exists (also re-add
  // ListChecks to the lucide-react import above, and this id back into
  // EditableDashboard.tsx + the admin/hr/accounting/inventory role defaults
  // below).
  // {
  //   id: 'task-overview',
  //   label: 'Task Overview',
  //   icon: ListChecks,
  //   description: 'Task completion and progress',
  //   defaultW: 6,
  //   defaultH: 3,
  //   minW: 4,
  //   minH: 3.5,
  //   roles: ['admin', 'hr', 'accounting', 'inventory'],
  // },
  {
    id: 'calendar',
    label: 'Calendar',
    icon: Calendar,
    description: 'Monthly calendar view',
    defaultW: 6,
    defaultH: 7,
    minW: 4,
    minH: 3.5,
    roles: ['admin', 'hr', 'accounting', 'inventory', 'default'],
    noChrome: true,
    noAutoFit: true,
  },
  // ── Sales & Orders widgets ──────────────────────────────────────────────────
  {
    id: 'sales-stats',
    label: 'Sales Overview',
    icon: ShoppingCart,
    description: 'Total sales, transactions, and refunds this month',
    defaultW: 12,
    defaultH: 3,
    minW: 4,
    minH: 3.5,
    // 'admin' deliberately excluded — re-summarizes numbers already covered
    // by kpi-strip + module-stats for that role.
    roles: ['sales'],
  },
  {
    id: 'sales-trend',
    label: 'Sales Trend',
    icon: TrendingUp,
    description: 'Monthly sales trend',
    defaultW: 6,
    defaultH: 4,
    minW: 4,
    minH: 3.5,
    roles: ['admin', 'sales'],
  },
  {
    id: 'top-customers',
    label: 'Top Customers',
    icon: Trophy,
    description: 'Highest-revenue customers, last 90 days',
    defaultW: 6,
    defaultH: 4,
    minW: 3,
    minH: 3.5,
    roles: ['admin', 'sales'],
  },
  {
    id: 'recent-orders',
    label: 'Recent Transactions',
    icon: Package,
    description: 'Latest POS transactions and status',
    defaultW: 6,
    defaultH: 4,
    minW: 3,
    minH: 3.5,
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
    minH: 3.5,
    roles: ['admin', 'sales', 'accounting'],
  },
  {
    id: 'pending-deliveries',
    label: 'Pending Reservations',
    icon: Bookmark,
    description: 'SKU reservations awaiting customer pickup',
    defaultW: 6,
    defaultH: 3,
    minW: 3,
    minH: 3.5,
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
    minH: 3.5,
    roles: ['admin', 'sales'],
  },
  {
    id: 'module-stats',
    label: 'Module Stats',
    icon: Layers,
    description:
      'Key metrics across POS, Inventory, Accounting, and CRM, with quick links to each module’s key sub-pages',
    defaultW: 12,
    defaultH: 4,
    minW: 6,
    // Lower than the shared 3.5 floor used elsewhere — that floor exists so
    // widgets sitting side-by-side in a row (Reminders, Employee Birthdays,
    // System Alerts, etc.) match heights. Module Stats is full-width with
    // nothing beside it to match, and its own natural content comfortably
    // fits at 3 rows — flooring it to 3.5 just adds empty space under the
    // four cards for no visual benefit.
    minH: 3,
    roles: ['admin'],
  },
  {
    id: 'needs-attention',
    label: 'Needs Attention',
    icon: AlertCircle,
    description:
      'Pending approvals, overdue invoices, and COGS posting gaps merged into one prioritized feed',
    defaultW: 12,
    defaultH: 5,
    minW: 4,
    minH: 3.5,
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
    minH: 3.5,
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
    minH: 3.5,
    roles: ['admin', 'accounting'],
  },
  // ── HR widgets ───────────────────────────────────────────────────────────────
  // Not registered: there is no HR module on the backend (no employees/leave-management/
  // attendance/payroll controllers), so every one of these widgets' API calls 404s. Uncomment
  // once a real HR backend module exists (also re-add ClipboardCheck, Users2, CalendarClock,
  // Timer, Wallet, Receipt to the lucide-react import above, and their entries in
  // EditableDashboard.tsx, defaultWidgetsByRole.hr, and defaultLayoutsByRole.hr).
  // {
  //   id: 'attendance-summary',
  //   label: 'Attendance Summary',
  //   icon: ClipboardCheck,
  //   description: 'Present, absent, late, and on-leave counts',
  //   defaultW: 6,
  //   defaultH: 3,
  //   minW: 3,
  //   minH: 3.5,
  //   roles: ['admin', 'hr'],
  // },
  // {
  //   id: 'department-summary',
  //   label: 'Department Summary',
  //   icon: Users2,
  //   description: 'Headcount and active employees per department',
  //   defaultW: 6,
  //   defaultH: 4,
  //   minW: 3,
  //   minH: 3.5,
  //   roles: ['admin', 'hr'],
  // },
  // {
  //   id: 'leave-requests',
  //   label: 'Leave Requests',
  //   icon: CalendarClock,
  //   description: 'Pending leave requests awaiting review',
  //   defaultW: 4,
  //   defaultH: 4,
  //   minW: 3,
  //   minH: 3.5,
  //   roles: ['admin', 'hr'],
  // },
  // {
  //   id: 'overtime-requests',
  //   label: 'Overtime Requests',
  //   icon: Timer,
  //   description: 'Overtime requests and their status',
  //   defaultW: 4,
  //   defaultH: 4,
  //   minW: 3,
  //   minH: 3.5,
  //   roles: ['admin', 'hr'],
  // },
  // {
  //   id: 'payroll-summary',
  //   label: 'Payroll Summary',
  //   icon: Wallet,
  //   description: 'Current payroll period breakdown and net pay',
  //   defaultW: 4,
  //   defaultH: 5,
  //   minW: 3,
  //   minH: 4,
  //   roles: ['admin', 'hr'],
  // },
  // {
  //   id: 'payslip-status',
  //   label: 'Payslip Status',
  //   icon: Receipt,
  //   description: 'Payslip pipeline: computed, approved, generated, released',
  //   defaultW: 5,
  //   defaultH: 5,
  //   minW: 3,
  //   minH: 4,
  //   roles: ['admin', 'hr'],
  // },
]

export const widgetById: Record<string, WidgetDef> = Object.fromEntries(
  ALL_WIDGETS.map((w) => [w.id, w])
)

// ── Grid layout constants ─────────────────────────────────────────────────────

export const GRID_ROW_HEIGHT = 64
// 16 rather than 12 — a touch more breathing room between cards reads
// calmer/more considered. Must match EditableDashboard's GridLayout
// `margin` prop exactly, since this feeds the auto-fit height math below.
export const GRID_MARGIN_Y = 16

/**
 * Converts a measured natural content-area height (px) into a grid row count.
 * Accounts for the widget header, inner padding, and row-height formula.
 *   outerHeight = h * (ROW_HEIGHT + MARGIN_Y) - MARGIN_Y
 *   → h = ceil((outerHeight + MARGIN_Y) / (ROW_HEIGHT + MARGIN_Y))
 * WIDGET_OVERHEAD covers header (~38px) + p-3 padding top+bottom (24px) + 2px buffer.
 */
const WIDGET_OVERHEAD_PX = 64
// `noChrome` widgets (see WidgetDef) skip the header + p-3 padding entirely
// in view mode, so they only need a small buffer, not the full overhead —
// otherwise the grid reserves ~64px of dead space below their real content.
const NO_CHROME_OVERHEAD_PX = 2

export function fitHeightToContent(
  contentPx: number,
  minH = 1,
  overheadPx = WIDGET_OVERHEAD_PX
): number {
  const totalPx = contentPx + overheadPx
  const h = Math.ceil((totalPx + GRID_MARGIN_Y) / (GRID_ROW_HEIGHT + GRID_MARGIN_Y))
  return Math.max(h, minH)
}

/**
 * Returns a new layout where each item's `h` is auto-fitted to its measured
 * content height. Items without a measurement are left unchanged.
 *
 * The floor is each widget's own `minH` (usually 3, ~224px), not a fixed
 * tiny constant — a deliberate choice for visual consistency: several
 * small widgets (Reminders, System Alerts, Recent Activity, Employee
 * Birthdays, Sales by Branch) commonly sit side by side, and letting each
 * one shrink all the way down to its own bare-minimum content (a single
 * empty-state line can be under 100px) made them look like mismatched
 * scraps next to each other rather than a set of cards. Flooring at `minH`
 * gives them a shared baseline size when sparse, while still letting any
 * of them grow taller when they genuinely have more to show.
 */
export function fitLayoutToContent(
  layout: LayoutItem[],
  naturalHeights: Record<string, number>
): LayoutItem[] {
  return layout.map((item) => {
    if (widgetById[item.i]?.noAutoFit) return item
    const contentPx = naturalHeights[item.i]
    if (contentPx == null) return item
    const overheadPx = widgetById[item.i]?.noChrome ? NO_CHROME_OVERHEAD_PX : WIDGET_OVERHEAD_PX
    const h = fitHeightToContent(contentPx, item.minH ?? 1, overheadPx)
    return { ...item, h }
  })
}

/**
 * Vertically compacts a layout using a skyline/masonry packer, not just
 * collision avoidance — each item settles at the max of the "occupied
 * height so far" across only the columns it actually spans, so a narrow
 * item can slot into a gap beside a taller neighbor instead of being
 * pushed down to clear its neighbor's full height. The previous version
 * only checked "does this exact box collide with any placed box," which
 * kept short widgets pinned to a taller row-mate's bottom edge even when
 * their own column was free much higher up — e.g. a one-line "Reminders"
 * card next to a 5-row "Employee Birthdays" card would sit at Birthdays'
 * height instead of the shorter height it actually needed. Call this
 * after fitLayoutToContent so reduced `h` values open up real gaps for
 * later items to fill.
 */
export function compactLayoutVertically(layout: LayoutItem[]): LayoutItem[] {
  // Sort by y first, then x — this is the "reading order" that decides
  // priority when two items could both fit the same slot; it does not by
  // itself prevent later, narrower items from settling higher than an
  // earlier, wider one wherever their column spans don't overlap.
  const sorted = [...layout].sort((a, b) => (a.y !== b.y ? a.y - b.y : a.x - b.x))

  // skyline[col] = the lowest free y at that column, across the 12-col grid.
  const skyline = new Array<number>(GRID_COLS).fill(0)
  const placed: LayoutItem[] = []

  for (const item of sorted) {
    const colStart = Math.max(0, Math.round(item.x))
    const colEnd = Math.min(GRID_COLS, Math.round(item.x + item.w))
    let y = 0
    for (let col = colStart; col < colEnd; col++) {
      y = Math.max(y, skyline[col] ?? 0)
    }
    placed.push({ ...item, y })
    for (let col = colStart; col < colEnd; col++) {
      skyline[col] = y + item.h
    }
  }

  // Return in original order so callers don't need to re-sort.
  const resultMap = new Map(placed.map((item) => [item.i, item]))
  return layout.map((item) => resultMap.get(item.i) ?? item)
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
  admin: [
    'kpi-strip',
    'calendar',
    'module-stats',
    'needs-attention',
    'recent-activity',
    'sales-by-branch',
  ],
  hr: ['stats', 'recent-activity', 'employee-birthdays', 'calendar'],
  accounting: ['stats', 'outstanding-invoices', 'pending-approvals', 'recent-activity'],
  inventory: ['stats', 'recent-activity', 'quick-actions', 'system-alerts'],
  sales: [
    'sales-stats',
    'sales-trend',
    'top-customers',
    'recent-orders',
    'outstanding-invoices',
    'pending-deliveries',
  ],
  default: ['reminders', 'calendar', 'recent-activity'],
}

// ── Default grid layouts per role ─────────────────────────────────────────────

export const defaultLayoutsByRole: Record<DashboardRole, LayoutItem[]> = {
  admin: [
    // Numbers first (KPI strip, Calendar, Module Stats — each module card
    // already click-through to its own module home, plus a quick-links row
    // to that module's key sub-pages), then the actionable feed, then
    // reference tools at the bottom.
    { i: 'kpi-strip', x: 0, y: 0, w: 12, h: 3, minW: 6, minH: 2 },
    // h fixed (not auto-fitted, see noAutoFit) — both the day-grid and list
    // views size their content area to this same fixed height (see
    // CALENDAR_WIDGET_H in CalendarWidget.tsx, which must match), so
    // toggling between them never reflows anything below it.
    // h is 0.5 more than CALENDAR_WIDGET_H (CalendarWidget.tsx) on purpose —
    // the widget only fills 5 units of content, leaving half a unit of
    // legitimate blank space at the bottom of its own footprint as breathing
    // room before Module Stats. A plain y-offset doesn't survive: the
    // auto-fit sweep's compactLayoutVertically treats any gap between items
    // as empty space to remove, so the extra room has to belong to
    // calendar's own allocated height instead.
    { i: 'calendar', x: 0, y: 3, w: 12, h: 5.5, minW: 4, minH: 3.5 },
    { i: 'module-stats', x: 0, y: 8.5, w: 12, h: 4, minW: 6, minH: 3 },
    { i: 'needs-attention', x: 0, y: 12.5, w: 12, h: 5, minW: 4, minH: 3.5 },
    { i: 'recent-activity', x: 0, y: 17.5, w: 6, h: 4, minW: 3, minH: 3.5 },
    { i: 'sales-by-branch', x: 6, y: 17.5, w: 6, h: 4, minW: 3, minH: 3.5 },
  ],
  hr: [
    { i: 'stats', x: 0, y: 0, w: 12, h: 3, minW: 4, minH: 3.5 },
    { i: 'recent-activity', x: 0, y: 3, w: 12, h: 3, minW: 3, minH: 3.5 },
    { i: 'employee-birthdays', x: 0, y: 6, w: 4, h: 3, minW: 3, minH: 3.5 },
    { i: 'calendar', x: 4, y: 6, w: 8, h: 5, minW: 4, minH: 3.5 },
  ],
  accounting: [
    { i: 'stats', x: 0, y: 0, w: 12, h: 3, minW: 4, minH: 3.5 },
    { i: 'outstanding-invoices', x: 0, y: 3, w: 6, h: 3, minW: 4, minH: 3.5 },
    { i: 'pending-approvals', x: 6, y: 3, w: 6, h: 3, minW: 4, minH: 3.5 },
    { i: 'recent-activity', x: 0, y: 6, w: 12, h: 3, minW: 3, minH: 3.5 },
  ],
  inventory: [
    { i: 'stats', x: 0, y: 0, w: 12, h: 3, minW: 4, minH: 3.5 },
    { i: 'recent-activity', x: 0, y: 3, w: 6, h: 3, minW: 3, minH: 3.5 },
    { i: 'quick-actions', x: 6, y: 3, w: 3, h: 3, minW: 2, minH: 3.5 },
    { i: 'system-alerts', x: 9, y: 3, w: 3, h: 3, minW: 3, minH: 3.5 },
  ],
  default: [
    { i: 'reminders', x: 0, y: 0, w: 6, h: 3, minW: 2, minH: 3.5 },
    { i: 'calendar', x: 0, y: 3, w: 8, h: 5, minW: 4, minH: 3.5 },
    { i: 'recent-activity', x: 8, y: 3, w: 4, h: 3, minW: 3, minH: 3.5 },
  ],
  sales: [
    { i: 'sales-stats', x: 0, y: 0, w: 12, h: 3, minW: 4, minH: 3.5 },
    { i: 'sales-trend', x: 0, y: 3, w: 6, h: 4, minW: 4, minH: 3.5 },
    { i: 'top-customers', x: 6, y: 3, w: 6, h: 4, minW: 3, minH: 3.5 },
    { i: 'recent-orders', x: 0, y: 7, w: 7, h: 4, minW: 3, minH: 3.5 },
    { i: 'outstanding-invoices', x: 7, y: 7, w: 5, h: 3, minW: 3, minH: 3.5 },
    { i: 'pending-deliveries', x: 7, y: 10, w: 5, h: 3, minW: 3, minH: 3.5 },
  ],
}

const GRID_COLS = 12

/**
 * Places extra (non-default) widgets in row-filling shelves left to right —
 * e.g. two 6-wide widgets share a row, four 3-wide widgets share a row —
 * instead of one per row at x:0. Without this, clicking "Select All" (or
 * toggling any optional widget on) stacks every extra widget in a single
 * narrow left column, leaving most of each row's width empty.
 */
function packExtraWidgets(widgets: WidgetDef[], startY: number): LayoutItem[] {
  const placed: LayoutItem[] = []
  let cursorX = 0
  let cursorY = startY
  let rowHeight = 0

  for (const w of widgets) {
    const width = Math.min(w.defaultW, GRID_COLS)
    if (cursorX + width > GRID_COLS) {
      cursorX = 0
      cursorY += rowHeight
      rowHeight = 0
    }
    placed.push({
      i: w.id,
      x: cursorX,
      y: cursorY,
      w: width,
      h: w.defaultH,
      minW: w.minW,
      minH: w.minH,
    })
    cursorX += width
    rowHeight = Math.max(rowHeight, w.defaultH)
  }

  return placed
}

// Build a full layout for a role (all available widgets, with defaults for
// visible ones and packed shelf positions for the rest).
export function buildFullLayout(role: DashboardRole): LayoutItem[] {
  const defaults = defaultLayoutsByRole[role]
  const defaultMap = new Map(defaults.map((item) => [item.i, item]))
  const roleWidgets = widgetsByRole[role]

  const maxY = defaults.reduce((acc, item) => Math.max(acc, item.y + item.h), 0)
  const extraWidgets = roleWidgets.filter((w) => !defaultMap.has(w.id))
  const extra = packExtraWidgets(extraWidgets, maxY)

  return [...defaults, ...extra]
}
