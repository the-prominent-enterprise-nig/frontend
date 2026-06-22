'use client'

import { useRef, useEffect, useState, useCallback, type ReactNode } from 'react'
import { X, GripHorizontal, SlidersHorizontal } from 'lucide-react'
import { widgetById, CONFIGURABLE_WIDGET_IDS } from '@/src/libs/dashboardWidgets'
import {
  WidgetSizeContext,
  WidgetConfigContext,
  WidgetHeaderContext,
  getWidgetVariant,
} from './WidgetSizeContext'
import WidgetSettingsPanel from './WidgetSettingsPanel'

type Props = {
  id: string
  isEditing: boolean
  onRemove: (id: string) => void
  /** Called whenever the widget's inner content changes height (natural, unconstrained px). */
  onNaturalHeightChange?: (id: string, heightPx: number) => void
  /** This widget's persisted settings (from widgetSettings state). */
  settings: Record<string, unknown>
  /** Called when the user changes settings via the settings panel. */
  onSettingsChange: (settings: Record<string, unknown>) => void
  children: React.ReactNode
}

export default function DashboardWidgetWrapper({
  id,
  isEditing,
  onRemove,
  onNaturalHeightChange,
  settings,
  onSettingsChange,
  children,
}: Props) {
  const widget = widgetById[id]
  const label = widget?.label ?? id
  const emoji = widget?.emoji ?? '📦'

  const contentRef = useRef<HTMLDivElement>(null)
  // innerRef wraps children so we can measure their natural (unconstrained) height.
  const innerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 600, height: 400 })
  const [showSettings, setShowSettings] = useState(false)
  const [headerExtra, setHeaderExtra] = useState<ReactNode>(null)

  // Close settings panel when editing mode ends.
  useEffect(() => {
    if (!isEditing) setShowSettings(false)
  }, [isEditing])

  // Observe the content area so widgets can react to their actual available space.
  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    const update = (w: number, h: number) => setSize({ width: w, height: h })
    update(el.clientWidth, el.clientHeight)
    const ro = new ResizeObserver((entries) => {
      const e = entries[0]
      if (e) update(e.contentRect.width, e.contentRect.height)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Stable callback to avoid re-running the observer effect on each render.
  const reportHeight = useCallback(
    (el: HTMLDivElement) => {
      if (onNaturalHeightChange) {
        onNaturalHeightChange(id, el.offsetHeight)
      }
    },
    [id, onNaturalHeightChange]
  )

  // Observe the inner content div for natural height changes.
  useEffect(() => {
    const el = innerRef.current
    if (!el || !onNaturalHeightChange) return
    reportHeight(el)
    const ro = new ResizeObserver(() => reportHeight(el))
    ro.observe(el)
    return () => ro.disconnect()
  }, [reportHeight, onNaturalHeightChange])

  const variant = getWidgetVariant(size.width)
  const sizeContextValue = { width: size.width, height: size.height, variant }
  const configContextValue = { settings }
  const isConfigurable = CONFIGURABLE_WIDGET_IDS.has(id)

  return (
    <div
      className={`flex min-w-40 flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 transition
        ${
          isEditing
            ? 'h-full min-h-0 ring-purple-300 shadow-md shadow-purple-100'
            : 'h-full ring-zinc-200 hover:ring-zinc-300'
        }`}
    >
      {/* Widget header — always shrink-0 so it never gets clipped */}
      <div
        className={`flex shrink-0 items-center gap-2 border-b border-zinc-100 px-3 py-2
          ${isEditing ? 'cursor-grab active:cursor-grabbing bg-purple-50 widget-drag-handle' : 'bg-white'}`}
      >
        {isEditing && <GripHorizontal className="h-4 w-4 shrink-0 text-purple-400" />}
        <span className="text-sm leading-none">{emoji}</span>
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-800 select-none">
          {label}
        </p>
        {!isEditing && headerExtra}
        {isEditing && isConfigurable && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setShowSettings((s) => !s)
            }}
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition ${
              showSettings
                ? 'bg-purple-100 text-purple-600'
                : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600'
            }`}
            aria-label={showSettings ? 'Close widget settings' : 'Customise widget'}
          >
            <SlidersHorizontal className="h-3 w-3" />
          </button>
        )}
        {isEditing && (
          <button
            type="button"
            onClick={() => onRemove(id)}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-zinc-400 transition hover:bg-red-50 hover:text-red-500"
            aria-label={`Remove ${label}`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Content area — provides size + config contexts to children.
          Edit mode: flex-1 fills the full grid item (enables scrolling and shows resize area).
          View mode: natural height so the card shrinks to its content with no blank space. */}
      <div
        ref={contentRef}
        className={isEditing ? 'relative min-h-0 min-w-0 flex-1 overflow-hidden' : 'min-w-0'}
      >
        <WidgetHeaderContext.Provider value={{ setHeaderExtra }}>
          <WidgetSizeContext.Provider value={sizeContextValue}>
            <WidgetConfigContext.Provider value={configContextValue}>
              <div className={isEditing ? 'absolute inset-0 overflow-auto p-3' : 'p-3'}>
                {/* innerRef measures the natural content height for auto-fit calculations */}
                <div ref={innerRef}>
                  {isEditing && showSettings ? (
                    <WidgetSettingsPanel
                      widgetId={id}
                      settings={settings}
                      onChange={onSettingsChange}
                    />
                  ) : (
                    children
                  )}
                </div>
              </div>
            </WidgetConfigContext.Provider>
          </WidgetSizeContext.Provider>
        </WidgetHeaderContext.Provider>
      </div>
    </div>
  )
}
