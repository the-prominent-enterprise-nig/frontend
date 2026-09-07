'use client'

import 'react-grid-layout/css/styles.css'

import { useRef, useEffect, useState, useCallback } from 'react'
import { GridLayout } from 'react-grid-layout'
import type { LayoutItem as RGLLayoutItem } from 'react-grid-layout'
import {
  fitLayoutToContent,
  compactLayoutVertically,
  DEFAULT_WIDGET_SETTINGS,
  GRID_ROW_HEIGHT,
  GRID_MARGIN_Y,
  type LayoutItem,
} from '@/src/libs/dashboardWidgets'
import DashboardWidgetWrapper from './DashboardWidgetWrapper'

// Widgets
import StatsOverviewWidget from './widgets/StatsOverviewWidget'
import ModulesWidget from './widgets/ModulesWidget'
import RemindersWidget from './widgets/RemindersWidget'
import EmployeeBirthdaysWidget from './widgets/EmployeeBirthdaysWidget'
import RecentActivityWidget from './widgets/RecentActivityWidget'
import QuickActionsWidget from './widgets/QuickActionsWidget'
import SystemAlertsWidget from './widgets/SystemAlertsWidget'
import CalendarWidget from './widgets/CalendarWidget'
import SalesStatsWidget from './widgets/SalesStatsWidget'
import SalesTrendWidget from './widgets/SalesTrendWidget'
import TopCustomersWidget from './widgets/TopCustomersWidget'
import RecentOrdersWidget from './widgets/RecentOrdersWidget'
import OutstandingInvoicesWidget from './widgets/OutstandingInvoicesWidget'
import PendingDeliveriesWidget from './widgets/PendingDeliveriesWidget'
import SalesByBranchWidget from './widgets/SalesByBranchWidget'
import ModuleStatsWidget from './widgets/ModuleStatsWidget'
import PendingApprovalsWidget from './widgets/PendingApprovalsWidget'
import CogsGapsWidget from './widgets/CogsGapsWidget'
import RecentLeadsWidget from './widgets/RecentLeadsWidget'
import HeroKpiStripWidget from './widgets/HeroKpiStripWidget'
import NeedsAttentionWidget from './widgets/NeedsAttentionWidget'
// Not registered: there is no HR module on the backend (no employees/leave-management/
// attendance/payroll controllers), so every one of these widgets' API calls 404s. Uncomment
// once a real HR backend module exists.
// import AttendanceSummaryWidget from './widgets/AttendanceSummaryWidget'
// import DepartmentSummaryWidget from './widgets/DepartmentSummaryWidget'
// import LeaveRequestsWidget from './widgets/LeaveRequestsWidget'
// import OvertimeRequestsWidget from './widgets/OvertimeRequestsWidget'
// import PayrollSummaryWidget from './widgets/PayrollSummaryWidget'
// import PayslipStatusWidget from './widgets/PayslipStatusWidget'
// Not registered: /leave-management/summary and /attendance/overtime-requests are the
// same dead HR endpoints as above; Document Requests/Flagged Items were always hardcoded
// with no backend concept at all. See dashboardWidgets.ts's own comment for detail.
// import PendingRequestsWidget from './widgets/PendingRequestsWidget'
// Not registered: no Task concept exists anywhere in the backend.
// import TaskOverviewWidget from './widgets/TaskOverviewWidget'

// ── Widget component registry ─────────────────────────────────────────────────

type WidgetComponent = React.ComponentType<{ userName?: string }>
const WIDGET_COMPONENTS: Record<string, WidgetComponent> = {
  stats: StatsOverviewWidget,
  modules: ModulesWidget,
  reminders: RemindersWidget,
  'employee-birthdays': EmployeeBirthdaysWidget,
  'recent-activity': RecentActivityWidget,
  'quick-actions': QuickActionsWidget,
  'system-alerts': SystemAlertsWidget,
  calendar: CalendarWidget,
  'sales-stats': SalesStatsWidget,
  'sales-trend': SalesTrendWidget,
  'top-customers': TopCustomersWidget,
  'recent-orders': RecentOrdersWidget,
  'outstanding-invoices': OutstandingInvoicesWidget,
  'pending-deliveries': PendingDeliveriesWidget,
  'sales-by-branch': SalesByBranchWidget,
  'module-stats': ModuleStatsWidget,
  'pending-approvals': PendingApprovalsWidget,
  'cogs-gaps': CogsGapsWidget,
  'recent-leads': RecentLeadsWidget,
  'kpi-strip': HeroKpiStripWidget,
  'needs-attention': NeedsAttentionWidget,
  // 'attendance-summary': AttendanceSummaryWidget,
  // 'department-summary': DepartmentSummaryWidget,
  // 'leave-requests': LeaveRequestsWidget,
  // 'overtime-requests': OvertimeRequestsWidget,
  // 'payroll-summary': PayrollSummaryWidget,
  // 'payslip-status': PayslipStatusWidget,
  // 'pending-requests': PendingRequestsWidget,
  // 'task-overview': TaskOverviewWidget,
}

// ── Props ─────────────────────────────────────────────────────────────────────

type Props = {
  userName: string
  filteredLayout: LayoutItem[]
  isEditing: boolean
  onLayoutChange: (newLayout: LayoutItem[]) => void
  onRemoveWidget: (id: string) => void
  /**
   * A mutable ref that EditableDashboard writes natural content heights into.
   * The parent can read this on-demand (e.g. when "Done" is clicked) to
   * compute a fitted layout before saving.
   */
  naturalHeightsRef: React.MutableRefObject<Record<string, number>>
  /** Per-widget settings from useDashboardLayout. */
  widgetSettings: Record<string, Record<string, unknown>>
  /** Called when a widget's settings change via its settings panel. */
  onWidgetSettingsChange: (id: string, settings: Record<string, unknown>) => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function EditableDashboard({
  userName,
  filteredLayout,
  isEditing,
  onLayoutChange,
  onRemoveWidget,
  naturalHeightsRef,
  widgetSettings,
  onWidgetSettingsChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(1200)
  const [mounted, setMounted] = useState(false)

  // Keep a ref to the latest filteredLayout so the resize-stop timeout can
  // read the most recent version without stale-closure issues.
  const filteredLayoutRef = useRef(filteredLayout)
  filteredLayoutRef.current = filteredLayout

  // Measure container width to give the grid an accurate width.
  // mounted guard prevents the GridLayout from rendering during SSR,
  // avoiding a hydration mismatch on containerWidth.
  useEffect(() => {
    setMounted(true)
    const el = containerRef.current
    if (!el) return
    setContainerWidth(el.getBoundingClientRect().width)
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setContainerWidth(entry.contentRect.width)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  function handleLayoutChange(currentLayout: RGLLayoutItem[]): void {
    onLayoutChange(
      currentLayout.map((item) => ({
        i: item.i,
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
        minW: item.minW,
        minH: item.minH,
      }))
    )
  }

  // Re-fit all widget heights whenever the user opens edit mode, AND
  // whenever the visible widget count changes while already editing (e.g.
  // "Select All"/"Deselect All", or toggling one widget on) — otherwise
  // newly-revealed widgets are stuck at their rough defaultH guess forever,
  // since the one-time auto-fit below only ever fires once, on first mount.
  //
  // Several sweeps at increasing delays, not just one: revealing many
  // widgets at once (e.g. "Select All") starts that many independent data
  // fetches, which don't all resolve together. A single fit can catch most
  // widgets still on their loading skeleton — if it fires during a brief
  // lull while a couple of widgets are mid-fetch, their skeleton height
  // gets locked in, and nothing else re-triggers a fit for them once their
  // real (usually much shorter) content finally lands. The later sweeps
  // give slow widgets a chance to be measured correctly too.
  useEffect(() => {
    if (!isEditing) return
    const runFit = () => {
      const measured = Object.keys(naturalHeightsRef.current)
      if (measured.length === 0) return
      onLayoutChange(
        compactLayoutVertically(
          fitLayoutToContent(filteredLayoutRef.current, naturalHeightsRef.current)
        )
      )
    }
    const timers = [400, 1200, 2500].map((delay) => setTimeout(runFit, delay))
    return () => timers.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, filteredLayout.length])

  // Before the first fit, wait for every visible widget to report at least
  // once — avoids snapping to a half-measured layout on first paint.
  const hasAutoFittedRef = useRef(false)
  // Debounce timer: fires 150ms after the LAST height change, so variant-driven
  // re-renders (contentRef ResizeObserver → size update → widget re-render) have
  // settled before we compute the fitted layout.
  const autoFitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Collect per-widget natural content heights reported by each wrapper, and
  // keep re-fitting on every subsequent change — not just once on first
  // mount. A widget's natural height can change well after initial load
  // (a narrower viewport makes its internal grid reflow to more rows, new
  // data loads in, a widget gets toggled on) — without an ongoing re-fit,
  // its box stays sized for whatever content it had at the last fit, and
  // anything taller than that gets clipped/scrolled inside a stale box
  // rather than the box growing to fit it. This is not gated on edit mode:
  // the same staleness affects plain viewing, e.g. resizing the browser.
  const handleNaturalHeightChange = useCallback(
    (id: string, px: number) => {
      naturalHeightsRef.current[id] = px

      if (autoFitTimerRef.current) clearTimeout(autoFitTimerRef.current)
      autoFitTimerRef.current = setTimeout(() => {
        const reported = Object.keys(naturalHeightsRef.current).length
        const total = filteredLayoutRef.current.length
        if (total === 0) return
        if (!hasAutoFittedRef.current && reported < total) return
        hasAutoFittedRef.current = true
        const fitted = fitLayoutToContent(filteredLayoutRef.current, naturalHeightsRef.current)
        onLayoutChange(compactLayoutVertically(fitted))
      }, 150)
    },
    [naturalHeightsRef, onLayoutChange]
  )

  // Debounce timer for post-resize auto-fit.
  const resizeFitTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  /**
   * After a resize drag completes, wait one animation frame for the widget to
   * re-render at its new width (which may change its variant and content height),
   * then auto-fit the height of ALL visible widgets based on measured content.
   */
  function handleResizeStop(rglLayout: readonly RGLLayoutItem[]): void {
    if (resizeFitTimer.current) clearTimeout(resizeFitTimer.current)
    resizeFitTimer.current = setTimeout(() => {
      const currentLayout = rglLayout.map(
        (item) =>
          ({
            i: item.i,
            x: item.x,
            y: item.y,
            w: item.w,
            h: item.h,
            minW: item.minW,
            minH: item.minH,
          }) satisfies LayoutItem
      )
      onLayoutChange(fitLayoutToContent(currentLayout, naturalHeightsRef.current))
    }, 180)
  }

  // Clean up pending timers on unmount.
  useEffect(
    () => () => {
      if (resizeFitTimer.current) clearTimeout(resizeFitTimer.current)
      if (autoFitTimerRef.current) clearTimeout(autoFitTimerRef.current)
    },
    []
  )

  const rglLayout = filteredLayout as RGLLayoutItem[]

  return (
    <div ref={containerRef} className="w-full">
      {!mounted ? null : (
        <GridLayout
          width={containerWidth}
          layout={rglLayout}
          gridConfig={{
            cols: 12,
            rowHeight: GRID_ROW_HEIGHT,
            margin: [GRID_MARGIN_Y, GRID_MARGIN_Y],
            containerPadding: [0, 0],
            maxRows: Infinity,
          }}
          dragConfig={{ enabled: isEditing, handle: '.widget-drag-handle' }}
          resizeConfig={{ enabled: isEditing, handles: ['se'] }}
          onLayoutChange={(layout) => handleLayoutChange([...layout] as LayoutItem[])}
          onResizeStop={handleResizeStop}
          className="layout"
        >
          {filteredLayout.map((item) => {
            const WidgetComponent = WIDGET_COMPONENTS[item.i]
            const itemSettings = widgetSettings[item.i] ?? DEFAULT_WIDGET_SETTINGS[item.i] ?? {}
            return (
              <div key={item.i} id={`widget-${item.i}`}>
                <DashboardWidgetWrapper
                  id={item.i}
                  isEditing={isEditing}
                  onRemove={onRemoveWidget}
                  onNaturalHeightChange={handleNaturalHeightChange}
                  settings={itemSettings}
                  onSettingsChange={(s) => onWidgetSettingsChange(item.i, s)}
                >
                  {WidgetComponent ? (
                    <WidgetComponent userName={userName} />
                  ) : (
                    <p className="text-sm text-zinc-400">Widget not found: {item.i}</p>
                  )}
                </DashboardWidgetWrapper>
              </div>
            )
          })}
        </GridLayout>
      )}
    </div>
  )
}
