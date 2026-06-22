'use client'

import { Check } from 'lucide-react'
import type { WidgetDef } from '@/src/libs/dashboardWidgets'

type Props = {
  allWidgets: WidgetDef[]
  visibleWidgets: string[]
  onToggle: (id: string) => void
  onSelectAll: () => void
  onDeselectAll: () => void
}

export default function DashboardWidgetSelector({
  allWidgets,
  visibleWidgets,
  onToggle,
  onSelectAll,
  onDeselectAll,
}: Props) {
  const count = visibleWidgets.length
  const total = allWidgets.length

  return (
    <div className="rounded-2xl border border-purple-200 bg-purple-50 p-4">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-purple-900">Widget Selector</p>
          <p className="text-xs text-purple-600 mt-0.5">
            Showing <span className="font-bold">{count}</span> of{' '}
            <span className="font-bold">{total}</span> components
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onSelectAll}
            className="rounded-lg border border-purple-300 bg-white px-3 py-1 text-xs font-medium text-purple-700 transition hover:bg-purple-100"
          >
            Select All
          </button>
          <button
            type="button"
            onClick={onDeselectAll}
            className="rounded-lg border border-purple-300 bg-white px-3 py-1 text-xs font-medium text-purple-700 transition hover:bg-purple-100"
          >
            Deselect All
          </button>
        </div>
      </div>

      {/* Widget pills */}
      <div className="flex flex-wrap gap-2">
        {allWidgets.map((widget) => {
          const isSelected = visibleWidgets.includes(widget.id)
          return (
            <button
              key={widget.id}
              type="button"
              onClick={() => onToggle(widget.id)}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition
                ${
                  isSelected
                    ? 'border-purple-500 bg-purple-600 text-white shadow-sm'
                    : 'border-zinc-200 bg-white text-zinc-600 hover:border-purple-300 hover:text-purple-700'
                }`}
            >
              <widget.icon className="h-3.5 w-3.5 shrink-0" />
              <span>{widget.label}</span>
              {isSelected && <Check className="h-3 w-3" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
