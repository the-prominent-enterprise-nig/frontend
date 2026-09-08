'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRef } from 'react'
import { RotateCcw, X, Pencil, Loader2, LayoutDashboard, Crown, Building2 } from 'lucide-react'
import { useDashboardLayout } from '@/src/hooks/useDashboardLayout'
import DashboardWidgetSelector from '@/src/components/dashboard/DashboardWidgetSelector'
import { DashboardBranchSwitcher } from '@/src/components/dashboard/DashboardBranchSwitcher'
import { CARD_SHADOW_RESTING } from '@/src/components/dashboard/DashboardWidgetWrapper'
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
  companyName?: string | null
  branchName?: string | null
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

function timeOfDayGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
}

export default function DashboardClient({
  userName,
  roles,
  primaryRole,
  companyName,
  branchName,
}: DashboardClientProps) {
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
        <div
          className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-gradient-to-r from-white via-white to-purple-50/60 px-4 py-4 sm:px-5 ${CARD_SHADOW_RESTING}`}
        >
          <div className="flex min-w-0 items-center gap-3.5">
            <Link
              href="/settings"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-purple-400 text-base font-bold text-white shadow-md shadow-purple-300/50 ring-2 ring-white transition-transform duration-200 hover:scale-105"
            >
              {initialsOf(userName)}
            </Link>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-xl font-bold tracking-tight text-zinc-900">
                  {timeOfDayGreeting()}, {userName}
                </h1>
                {primaryRole && (
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-white px-2.5 py-0.5 text-[11px] font-semibold text-purple-700 ring-1 ring-purple-200">
                    <Crown className="h-3 w-3" />
                    {primaryRole}
                  </span>
                )}
              </div>
              <p className="mt-0.5 flex flex-wrap items-center gap-1.5 truncate text-xs text-zinc-500">
                {(companyName || branchName) && (
                  <>
                    <Building2 className="h-3 w-3 shrink-0 text-zinc-400" />
                    <span>{[companyName, branchName].filter(Boolean).join(' · ')}</span>
                    <span className="text-zinc-300">•</span>
                  </>
                )}
                {new Date().toLocaleDateString('en-PH', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <DashboardBranchSwitcher />
            {layout.isEditing ? (
              <>
                <button
                  type="button"
                  onClick={layout.resetLayout}
                  className="flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 shadow-sm transition-all duration-200 hover:-translate-y-px hover:border-zinc-400 hover:shadow-md"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset Layout
                </button>
                <button
                  type="button"
                  onClick={handleDone}
                  className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:-translate-y-px hover:bg-purple-700 hover:shadow-md hover:shadow-purple-200"
                >
                  <X className="h-3.5 w-3.5" />
                  Done
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => layout.setIsEditing(true)}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 shadow-sm transition-all duration-200 hover:-translate-y-px hover:border-zinc-400 hover:shadow-md"
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
          <div className="flex h-56 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-zinc-200 bg-white text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-50">
              <LayoutDashboard className="h-5 w-5 text-purple-500" />
            </div>
            <p className="text-sm font-medium text-zinc-600">No widgets selected</p>
            <p className="text-xs text-zinc-400">
              Click &ldquo;Edit Dashboard&rdquo; and select widgets to display.
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
