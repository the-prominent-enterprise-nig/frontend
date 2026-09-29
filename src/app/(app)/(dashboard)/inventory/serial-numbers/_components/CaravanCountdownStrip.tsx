'use client'

import { AlertTriangle, CalendarClock } from 'lucide-react'
import {
  caravanCountdown,
  caravanDaysLeft,
  type CaravanAlert,
} from '@/src/schema/inventory/warehouses'
import { caravanLabel } from '@/src/libs/format/locationLabel'
import { useCaravanAlerts } from '@/src/components/inventory/caravan/useCaravanAlerts'
import { MONO } from '../../purchase-orders/_components/procurementTokens'

type Props = {
  selectedId?: string
  onSelect: (caravanId: string | undefined) => void
}

// Ended first (they need action), then soonest to end.
function byUrgency(a: CaravanAlert, b: CaravanAlert): number {
  if (a.ended !== b.ended) return a.ended ? -1 : 1
  return (caravanDaysLeft(a.endDate) ?? Infinity) - (caravanDaysLeft(b.endDate) ?? Infinity)
}

function cardTone(alert: CaravanAlert, selected: boolean): string {
  if (selected) return 'border-[#5b21b6] bg-[#f5f0fd] shadow-[0_0_0_3px_#f0e9fc]'
  if (alert.ended) return 'border-[#f3d7a8] bg-[#fdf6ea] hover:border-[#e6b872]'
  return 'border-[#e4e4e9] bg-white hover:border-[#c9c9d3]'
}

/**
 * Scenario 60 Part 3 — every running caravan with a countdown to its end
 * date, and every ended one still holding stock. Picking a card filters the
 * list below to that caravan (picking it again clears the filter).
 */
export default function CaravanCountdownStrip({ selectedId, onSelect }: Props) {
  const { alerts } = useCaravanAlerts()
  if (alerts.length === 0) return null

  return (
    <div className="flex gap-2.5 overflow-x-auto pb-1">
      {[...alerts].sort(byUrgency).map((alert) => {
        const selected = alert.id === selectedId
        return (
          <button
            key={alert.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onSelect(selected ? undefined : alert.id)}
            className={`flex w-[240px] shrink-0 flex-col gap-1 rounded-xl border px-3.5 py-2.5 text-left transition-colors ${cardTone(alert, selected)}`}
          >
            <span className="truncate text-[13px] font-semibold text-[#17171c]">
              {caravanLabel(alert)}
            </span>
            <span className="truncate text-[11.5px] text-[#8b8b9b]">
              {alert.hostBranch ? `at ${alert.hostBranch.name}` : '—'}
              {alert.addressLine1 ? ` · ${alert.addressLine1}` : ''}
            </span>
            <span className="mt-1 flex items-center justify-between gap-2 text-[12px]">
              <span
                className={`inline-flex items-center gap-1 font-medium ${
                  alert.ended ? 'text-[#8a4b06]' : 'text-[#3f1490]'
                }`}
              >
                {alert.ended ? (
                  <AlertTriangle className="h-3.5 w-3.5" />
                ) : (
                  <CalendarClock className="h-3.5 w-3.5" />
                )}
                {caravanCountdown(alert.endDate)}
              </span>
              <span className={`${MONO} text-[11.5px] text-[#5b5b6b]`}>
                {alert.unitsHeld} {alert.unitsHeld === 1 ? 'unit' : 'units'}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
