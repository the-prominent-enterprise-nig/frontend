'use client'

import { useUrlFilters } from '@/src/components/ssr/UrlFilters'
import { DAY_OPTIONS, DEFAULT_DAYS, type DayOption } from '../_params'

/** The only interactive control on the page; the rest is server-rendered. */
export function DaysHorizon({ days }: { days: DayOption }): React.JSX.Element {
  const { setParams } = useUrlFilters()

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-zinc-600">Days Horizon:</span>
      <div className="flex overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
        {DAY_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={days === option}
            onClick={() => setParams({ days: option === DEFAULT_DAYS ? undefined : option })}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              days === option
                ? 'bg-prominent-purple-700 text-white'
                : 'text-zinc-600 hover:bg-zinc-50'
            }`}
          >
            {option}d
          </button>
        ))}
      </div>
    </div>
  )
}
