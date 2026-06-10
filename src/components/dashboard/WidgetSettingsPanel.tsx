'use client'

import { Check } from 'lucide-react'
import type { QuickActionsSettings } from '@/src/libs/dashboardWidgets'
import { QUICK_ACTIONS } from './widgets/QuickActionsWidget'

type Props = {
  widgetId: string
  settings: Record<string, unknown>
  onChange: (settings: Record<string, unknown>) => void
}

function QuickActionsSettingsPanel({
  settings,
  onChange,
}: {
  settings: Record<string, unknown>
  onChange: (s: Record<string, unknown>) => void
}) {
  const s = settings as Partial<QuickActionsSettings>
  const enabledActions = s.enabledActions ?? QUICK_ACTIONS.map((a) => a.id)

  function toggle(id: string): void {
    const next = enabledActions.includes(id)
      ? enabledActions.filter((a) => a !== id)
      : [...enabledActions, id]
    onChange({ ...settings, enabledActions: next })
  }

  return (
    <div className="flex flex-col">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
        Visible Actions
      </p>
      {QUICK_ACTIONS.map((action) => {
        const enabled = enabledActions.includes(action.id)
        return (
          <button
            key={action.id}
            type="button"
            onClick={() => toggle(action.id)}
            className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-xs font-medium transition ${
              enabled ? 'text-purple-700' : 'text-zinc-400 hover:bg-zinc-50 hover:text-zinc-600'
            }`}
          >
            <span
              className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border transition ${
                enabled ? 'border-purple-500 bg-purple-500' : 'border-zinc-300 bg-white'
              }`}
            >
              {enabled && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
            </span>
            {action.label}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Renders the appropriate settings panel for a given widget.
 * Currently supports: 'quick-actions'.
 * Extend this file to add settings panels for other widgets.
 */
export default function WidgetSettingsPanel({ widgetId, settings, onChange }: Props) {
  if (widgetId === 'quick-actions') {
    return <QuickActionsSettingsPanel settings={settings} onChange={onChange} />
  }
  return (
    <div className="flex h-16 items-center justify-center">
      <p className="text-xs text-zinc-400">No settings available</p>
    </div>
  )
}
