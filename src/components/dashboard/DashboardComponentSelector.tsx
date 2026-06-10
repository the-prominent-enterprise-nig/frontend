'use client'

import { Settings2 } from 'lucide-react'
import type { WidgetDef } from '@/src/libs/dashboardWidgetConfig'

type DashboardComponentSelectorProps = {
  allWidgets: WidgetDef[]
  visibleWidgets: string[]
  onToggle: (id: string) => void
  onSelectAll: () => void
  onDeselectAll: () => void
}

export default function DashboardComponentSelector({
  allWidgets,
  visibleWidgets,
  onToggle,
  onSelectAll,
  onDeselectAll,
}: DashboardComponentSelectorProps) {
  const visibleCount = allWidgets.filter((w) => visibleWidgets.includes(w.id)).length
  const total = allWidgets.length
  const allSelected = visibleCount === total

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-1 flex items-center gap-2">
        <Settings2 className="h-4 w-4 text-zinc-600" />
        <h2 className="text-base font-semibold text-zinc-900">Components</h2>
      </div>
      <p className="mb-4 text-sm text-zinc-500">
        Select which components to display on your dashboard.
      </p>

      <div className="flex flex-wrap gap-2.5">
        {allWidgets.map((widget) => {
          const checked = visibleWidgets.includes(widget.id)
          return (
            <button
              key={widget.id}
              type="button"
              onClick={() => onToggle(widget.id)}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                checked
                  ? 'border-prominent-purple-400 bg-prominent-purple-50 text-prominent-purple-700'
                  : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50'
              }`}
            >
              {/* Custom checkbox */}
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                  checked
                    ? 'border-prominent-purple-500 bg-prominent-purple-500'
                    : 'border-zinc-300 bg-white'
                }`}
              >
                {checked && (
                  <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 10 8" fill="none">
                    <path
                      d="M1 4l3 3 5-6"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </span>
              <span>{widget.emoji}</span>
              <span>{widget.label}</span>
            </button>
          )
        })}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm text-zinc-500">
          Showing <span className="font-semibold text-zinc-900">{visibleCount}</span> of{' '}
          <span className="font-semibold text-zinc-900">{total}</span> components
        </p>
        <button
          type="button"
          onClick={allSelected ? onDeselectAll : onSelectAll}
          className="text-sm font-medium text-prominent-purple-600 hover:text-prominent-purple-700"
        >
          {allSelected ? 'Deselect All' : 'Select All'}
        </button>
      </div>
    </div>
  )
}
