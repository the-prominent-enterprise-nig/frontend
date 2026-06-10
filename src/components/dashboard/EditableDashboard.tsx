'use client'

import 'react-grid-layout/css/styles.css'

import { useRef, useEffect, useState, useCallback } from 'react'
import { GridLayout } from 'react-grid-layout'
import type { LayoutItem as RGLLayoutItem } from 'react-grid-layout'
import {
  fitLayoutToContent,
  compactLayoutVertically,
  DEFAULT_WIDGET_SETTINGS,
  type LayoutItem,
} from '@/src/libs/dashboardWidgets'
import DashboardWidgetWrapper from './DashboardWidgetWrapper'

// Widgets
import StatsOverviewWidget from './widgets/StatsOverviewWidget'
import ModulesWidget from './widgets/ModulesWidget'
import WeatherWidget from './widgets/WeatherWidget'
import EventsWidget from './widgets/EventsWidget'
import MemoAdvisoryWidget from './widgets/MemoAdvisoryWidget'
import PendingRequestsWidget from './widgets/PendingRequestsWidget'
import AnnouncementsWidget from './widgets/AnnouncementsWidget'
import RemindersWidget from './widgets/RemindersWidget'
import AttendanceSummaryWidget from './widgets/AttendanceSummaryWidget'
import LeaveRequestsWidget from './widgets/LeaveRequestsWidget'
import OvertimeRequestsWidget from './widgets/OvertimeRequestsWidget'
import PayrollSummaryWidget from './widgets/PayrollSummaryWidget'
import PayslipStatusWidget from './widgets/PayslipStatusWidget'
import EmployeeBirthdaysWidget from './widgets/EmployeeBirthdaysWidget'
import RecentActivityWidget from './widgets/RecentActivityWidget'
import QuickActionsWidget from './widgets/QuickActionsWidget'
import SystemAlertsWidget from './widgets/SystemAlertsWidget'
import TaskOverviewWidget from './widgets/TaskOverviewWidget'
import CalendarWidget from './widgets/CalendarWidget'
import DepartmentSummaryWidget from './widgets/DepartmentSummaryWidget'
import SalesStatsWidget from './widgets/SalesStatsWidget'
import SalesTrendWidget from './widgets/SalesTrendWidget'
import TopCustomersWidget from './widgets/TopCustomersWidget'
import RecentOrdersWidget from './widgets/RecentOrdersWidget'
import OutstandingInvoicesWidget from './widgets/OutstandingInvoicesWidget'
import PendingDeliveriesWidget from './widgets/PendingDeliveriesWidget'
import SalesByBranchWidget from './widgets/SalesByBranchWidget'
import EnterpriseSummaryWidget from './widgets/EnterpriseSummaryWidget'

// ── Widget component registry ─────────────────────────────────────────────────

type WidgetComponent = React.ComponentType<{ userName?: string }>
const WIDGET_COMPONENTS: Record<string, WidgetComponent> = {
  stats: StatsOverviewWidget,
  modules: ModulesWidget,
  weather: WeatherWidget,
  events: EventsWidget,
  'memo-advisory': MemoAdvisoryWidget,
  'pending-requests': PendingRequestsWidget,
  announcements: AnnouncementsWidget,
  reminders: RemindersWidget,
  'attendance-summary': AttendanceSummaryWidget,
  'leave-requests': LeaveRequestsWidget,
  'overtime-requests': OvertimeRequestsWidget,
  'payroll-summary': PayrollSummaryWidget,
  'payslip-status': PayslipStatusWidget,
  'employee-birthdays': EmployeeBirthdaysWidget,
  'recent-activity': RecentActivityWidget,
  'quick-actions': QuickActionsWidget,
  'system-alerts': SystemAlertsWidget,
  'task-overview': TaskOverviewWidget,
  calendar: CalendarWidget,
  'department-summary': DepartmentSummaryWidget,
  'sales-stats': SalesStatsWidget,
  'sales-trend': SalesTrendWidget,
  'top-customers': TopCustomersWidget,
  'recent-orders': RecentOrdersWidget,
  'outstanding-invoices': OutstandingInvoicesWidget,
  'pending-deliveries': PendingDeliveriesWidget,
  'sales-by-branch': SalesByBranchWidget,
  'enterprise-summary': EnterpriseSummaryWidget,
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

  // One-time auto-fit flag — fires when all visible widgets have reported heights.
  const hasAutoFittedRef = useRef(false)
  // Debounce timer: fires 100ms after the LAST height change, so variant-driven
  // re-renders (contentRef ResizeObserver → size update → widget re-render) have
  // settled before we compute the fitted layout.
  const autoFitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Collect per-widget natural content heights reported by each wrapper.
  // Triggers a one-time auto-fit once all heights have settled.
  const handleNaturalHeightChange = useCallback(
    (id: string, px: number) => {
      naturalHeightsRef.current[id] = px

      if (!hasAutoFittedRef.current) {
        if (autoFitTimerRef.current) clearTimeout(autoFitTimerRef.current)
        autoFitTimerRef.current = setTimeout(() => {
          const reported = Object.keys(naturalHeightsRef.current).length
          const total = filteredLayoutRef.current.length
          if (reported >= total && total > 0) {
            hasAutoFittedRef.current = true
            const fitted = fitLayoutToContent(filteredLayoutRef.current, naturalHeightsRef.current)
            onLayoutChange(compactLayoutVertically(fitted))
          }
        }, 100)
      }
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
            rowHeight: 64,
            margin: [12, 12],
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
              <div key={item.i}>
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
