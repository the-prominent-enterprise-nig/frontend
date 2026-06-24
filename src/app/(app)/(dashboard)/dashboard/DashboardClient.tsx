'use client'

import dynamic from 'next/dynamic'
import { useRef } from 'react'
import { RotateCcw, X, Pencil, Loader2 } from 'lucide-react'
import { useDashboardLayout } from '@/src/hooks/useDashboardLayout'
import DashboardWidgetSelector from '@/src/components/dashboard/DashboardWidgetSelector'
import {
  widgetsByRole,
  fitLayoutToContent,
  compactLayoutVertically,
  type DashboardRole,
} from '@/src/libs/dashboardWidgets'

// Dynamically import the grid (avoids SSR issues with WidthProvider).
const EditableDashboard = dynamic(() => import('@/src/components/dashboard/EditableDashboard'), {
  ssr: false,
  loading: () => (
    <div className="flex h-64 items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-purple-400" />
    </div>
  ),
})

type DashboardClientProps = {
  userName: string
  roles: string[]
  primaryRole?: string
}

function resolveDashboardRole(roles: string[], primaryRole?: string): DashboardRole {
  if (primaryRole === 'Business Owner' || roles.includes('Business Owner')) return 'admin'
  if (primaryRole === 'Branch Manager' || roles.includes('Branch Manager')) return 'admin'
  if (roles.some((r) => r === 'Superadmin')) return 'admin'
  if (primaryRole === 'Accountant' || roles.includes('Accountant')) return 'accounting'
  if (primaryRole === 'Stock Controller' || roles.includes('Stock Controller')) return 'inventory'
  if (primaryRole === 'Marketing Manager' || roles.includes('Marketing Manager')) return 'sales'
  return 'default'
}

export default function DashboardClient({ userName, roles, primaryRole }: DashboardClientProps) {
  const dashboardRole = resolveDashboardRole(roles, primaryRole)
  const layout = useDashboardLayout(dashboardRole)

  // naturalHeightsRef is written by EditableDashboard as widgets render.
  // We read it synchronously when "Done" is clicked to compute fitted heights.
  const naturalHeightsRef = useRef<Record<string, number>>({})

  const allWidgets = widgetsByRole[dashboardRole]
  const allWidgetIds = allWidgets.map((w) => w.id)

  if (!layout.hydrated) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-purple-400" />
      </div>
    )
  }

  /** Compute auto-fitted heights, compact y positions to remove gaps, and save. */
  function handleDone(): void {
    const fittedLayout = fitLayoutToContent(layout.filteredLayout, naturalHeightsRef.current)
    const compactedLayout = compactLayoutVertically(fittedLayout)
    layout.saveWithFittedLayout(compactedLayout)
  }

  return (
    <div className="min-h-full bg-zinc-50 px-4 py-5 sm:px-6">
      <div className="mx-auto max-w-350 space-y-4">
        {/* Top bar: greeting + edit controls */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-zinc-900">Welcome back, {userName}</h1>
            <p className="text-sm text-zinc-500">
              {new Date().toLocaleDateString('en-PH', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {layout.isEditing ? (
              <>
                <button
                  type="button"
                  onClick={layout.resetLayout}
                  className="flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset Layout
                </button>
                <button
                  type="button"
                  onClick={handleDone}
                  className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-purple-700"
                >
                  <X className="h-3.5 w-3.5" />
                  Done
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => layout.setIsEditing(true)}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit Dashboard
              </button>
            )}
          </div>
        </div>

        {/* Widget selector — only in edit mode */}
        {layout.isEditing && (
          <DashboardWidgetSelector
            allWidgets={allWidgets}
            visibleWidgets={layout.visibleWidgets}
            onToggle={layout.toggleWidget}
            onSelectAll={() => layout.selectAll(allWidgetIds)}
            onDeselectAll={layout.deselectAll}
          />
        )}

        {/* Grid dashboard */}
        {layout.visibleWidgets.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-zinc-200 bg-white text-center">
            <p className="text-sm font-medium text-zinc-500">No widgets selected</p>
            <p className="text-xs text-zinc-400">
              Click "Edit Dashboard" and select widgets to display.
            </p>
          </div>
        ) : (
          <EditableDashboard
            userName={userName}
            filteredLayout={layout.filteredLayout}
            isEditing={layout.isEditing}
            onLayoutChange={layout.updateLayout}
            onRemoveWidget={layout.toggleWidget}
            naturalHeightsRef={naturalHeightsRef}
            widgetSettings={layout.widgetSettings}
            onWidgetSettingsChange={layout.updateWidgetSettings}
          />
        )}
      </div>
    </div>
  )
}
