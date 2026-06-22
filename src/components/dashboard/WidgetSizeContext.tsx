'use client'

import { createContext, useContext, type ReactNode } from 'react'

// ── Widget config context ─────────────────────────────────────────────────────
// Provided by DashboardWidgetWrapper so any widget can read its own settings.

export type WidgetConfigContextValue = {
  /** This widget's persisted settings (empty object if none). */
  settings: Record<string, unknown>
}

export const WidgetConfigContext = createContext<WidgetConfigContextValue>({
  settings: {},
})

export function useWidgetConfig(): WidgetConfigContextValue {
  return useContext(WidgetConfigContext)
}

export type WidgetVariant = 'xs' | 'sm' | 'md' | 'lg'

export type WidgetSizeContextValue = {
  width: number
  height: number
  variant: WidgetVariant
}

export const WidgetSizeContext = createContext<WidgetSizeContextValue>({
  width: 600,
  height: 400,
  variant: 'lg',
})

export function useWidgetSize(): WidgetSizeContextValue {
  return useContext(WidgetSizeContext)
}

// ── Widget header extras context ──────────────────────────────────────────────
// Lets a widget render content into its own wrapper's title bar.

export type WidgetHeaderContextValue = {
  setHeaderExtra: (node: ReactNode) => void
}

export const WidgetHeaderContext = createContext<WidgetHeaderContextValue>({
  setHeaderExtra: () => {},
})

export function useWidgetHeader(): WidgetHeaderContextValue {
  return useContext(WidgetHeaderContext)
}

// Derives a named size variant from the content area's pixel width.
// Thresholds are tuned to the 12-column grid at ~960px container width.
export function getWidgetVariant(width: number): WidgetVariant {
  if (width < 250) return 'xs' // ~3 cols
  if (width < 390) return 'sm' // ~4–5 cols
  if (width < 560) return 'md' // ~6 cols
  return 'lg' // 7+ cols
}
