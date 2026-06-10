'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  defaultWidgetsByRole,
  buildFullLayout,
  compactLayoutVertically,
  DEFAULT_WIDGET_SETTINGS,
  type DashboardRole,
  type LayoutItem,
  type SavedDashboardState,
} from '@/src/libs/dashboardWidgets'

function storageKey(role: DashboardRole): string {
  return `prominent-dashboard-v3-${role}`
}

export type DashboardLayoutState = {
  visibleWidgets: string[]
  layout: LayoutItem[]
  filteredLayout: LayoutItem[]
  isEditing: boolean
  hydrated: boolean
  widgetSettings: Record<string, Record<string, unknown>>
  setIsEditing: (editing: boolean) => void
  toggleWidget: (id: string) => void
  updateLayout: (newItems: LayoutItem[]) => void
  updateWidgetSettings: (id: string, settings: Record<string, unknown>) => void
  resetLayout: () => void
  saveAndClose: () => void
  /** Save a pre-computed fitted layout (e.g. after auto-fit) and exit editing. */
  saveWithFittedLayout: (fittedItems: LayoutItem[]) => void
  selectAll: (allIds: string[]) => void
  deselectAll: () => void
}

export function useDashboardLayout(role: DashboardRole): DashboardLayoutState {
  const defaultWidgets = defaultWidgetsByRole[role]

  const [visibleWidgets, setVisibleWidgets] = useState<string[]>(defaultWidgets)
  const [layout, setLayout] = useState<LayoutItem[]>(() => buildFullLayout(role))
  const [isEditing, setIsEditing] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [widgetSettings, setWidgetSettings] = useState<Record<string, Record<string, unknown>>>(
    () => ({ ...DEFAULT_WIDGET_SETTINGS })
  )

  // Load persisted state from localStorage after mount.
  useEffect(() => {
    const saved = localStorage.getItem(storageKey(role))
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as unknown
        if (
          parsed !== null &&
          typeof parsed === 'object' &&
          'visibleWidgets' in parsed &&
          'layout' in parsed &&
          Array.isArray((parsed as SavedDashboardState).visibleWidgets) &&
          Array.isArray((parsed as SavedDashboardState).layout)
        ) {
          const state = parsed as SavedDashboardState
          setVisibleWidgets(state.visibleWidgets)
          // Merge saved layout with the full layout (handles newly added widgets).
          const fullLayout = buildFullLayout(role)
          const savedMap = new Map(state.layout.map((item) => [item.i, item]))
          const merged = fullLayout.map((item) => savedMap.get(item.i) ?? item)
          // Compact visible widgets' y positions to fix gaps from old saves.
          const visibleSet = new Set(state.visibleWidgets)
          const visibleItems = merged.filter((item) => visibleSet.has(item.i))
          const compactedMap = new Map(
            compactLayoutVertically(visibleItems).map((item) => [item.i, item])
          )
          setLayout(merged.map((item) => compactedMap.get(item.i) ?? item))
          // Merge saved widget settings with defaults (handles newly added widgets).
          const savedSettings =
            state.widgetSettings && typeof state.widgetSettings === 'object'
              ? { ...DEFAULT_WIDGET_SETTINGS, ...state.widgetSettings }
              : { ...DEFAULT_WIDGET_SETTINGS }
          setWidgetSettings(savedSettings)
        } else {
          setVisibleWidgets(defaultWidgets)
          setLayout(buildFullLayout(role))
        }
      } catch {
        setVisibleWidgets(defaultWidgets)
        setLayout(buildFullLayout(role))
      }
    } else {
      setVisibleWidgets(defaultWidgets)
      setLayout(buildFullLayout(role))
    }
    setHydrated(true)
  }, [role])

  // Only expose visible widgets' layout items to the grid.
  const filteredLayout = layout.filter((item) => visibleWidgets.includes(item.i))

  function toggleWidget(id: string): void {
    setVisibleWidgets((prev) => {
      if (prev.includes(id)) {
        return prev.filter((w) => w !== id)
      }
      // When adding a widget back, ensure it has a layout entry.
      setLayout((prevLayout) => {
        const exists = prevLayout.some((item) => item.i === id)
        if (exists) return prevLayout
        const maxY = prevLayout.reduce((acc, item) => Math.max(acc, item.y + item.h), 0)
        const fullLayout = buildFullLayout(role)
        const def = fullLayout.find((item) => item.i === id)
        return [...prevLayout, def ? { ...def, y: maxY } : { i: id, x: 0, y: maxY, w: 6, h: 4 }]
      })
      return [...prev, id]
    })
  }

  const updateLayout = useCallback((newItems: LayoutItem[]): void => {
    setLayout((prev) => {
      const incomingMap = new Map(newItems.map((item) => [item.i, item]))
      return prev.map((item) => incomingMap.get(item.i) ?? item)
    })
  }, [])

  function updateWidgetSettings(id: string, settings: Record<string, unknown>): void {
    setWidgetSettings((prev) => ({ ...prev, [id]: settings }))
  }

  function resetLayout(): void {
    setVisibleWidgets(defaultWidgets)
    setLayout(buildFullLayout(role))
    setWidgetSettings({ ...DEFAULT_WIDGET_SETTINGS })
  }

  function saveAndClose(): void {
    const state: SavedDashboardState = { visibleWidgets, layout, widgetSettings }
    localStorage.setItem(storageKey(role), JSON.stringify(state))
    setIsEditing(false)
  }

  /**
   * Merges a pre-computed fitted layout into the full layout, saves to
   * localStorage, and exits editing — all in one synchronous operation so
   * the saved data always reflects the fitted heights.
   */
  function saveWithFittedLayout(fittedItems: LayoutItem[]): void {
    const fittedMap = new Map(fittedItems.map((item) => [item.i, item]))
    const nextLayout = layout.map((item) => fittedMap.get(item.i) ?? item)
    setLayout(nextLayout)
    const state: SavedDashboardState = { visibleWidgets, layout: nextLayout, widgetSettings }
    localStorage.setItem(storageKey(role), JSON.stringify(state))
    setIsEditing(false)
  }

  function selectAll(allIds: string[]): void {
    setVisibleWidgets(allIds)
  }

  function deselectAll(): void {
    setVisibleWidgets([])
  }

  return {
    visibleWidgets,
    layout,
    filteredLayout,
    isEditing,
    hydrated,
    widgetSettings,
    setIsEditing,
    toggleWidget,
    updateLayout,
    updateWidgetSettings,
    resetLayout,
    saveAndClose,
    saveWithFittedLayout,
    selectAll,
    deselectAll,
  }
}
