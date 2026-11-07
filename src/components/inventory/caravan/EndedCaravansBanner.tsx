'use client'

import Link from 'next/link'
import { AlertTriangle, ArrowRight } from 'lucide-react'
import { ALL_CARAVANS, type CaravanAlert } from '@/src/schema/inventory/warehouses'
import { caravanLabelWithPlace } from '@/src/libs/format/locationLabel'
import { useCaravanAlerts } from './useCaravanAlerts'

type Props = {
  /** Narrows an unrestricted viewer to one host (the POS terminal's branch). */
  hostBranchId?: string | null
  /** 'inventory' links to the caravans; 'pos' is a notice only — a cashier
   * can't transfer, so it says who to ask instead. */
  variant: 'inventory' | 'pos'
  enabled?: boolean
  /** Replaces the link with an in-page action — for the General Stockbook
   * itself, where the link would only point back at the page. Gets the one
   * caravan's id when only one has ended, nothing for "all of them". */
  onView?: (caravanId?: string) => void
}

const VIEW_CLASS =
  'inline-flex shrink-0 items-center gap-1 font-medium text-[#5b21b6] hover:underline'

function unitsText(n: number): string {
  return `${n} ${n === 1 ? 'unit' : 'units'}`
}

/** "Dumalag Caravan has ended" for one, "3 ended caravans" for several. */
function headline(ended: CaravanAlert[]): string {
  const units = unitsText(ended.reduce((sum, a) => sum + a.unitsHeld, 0))
  return ended.length === 1
    ? `${caravanLabelWithPlace(ended[0])} has ended and still holds ${units}`
    : `${ended.length} ended caravans still hold ${units}`
}

/**
 * Scenario 60 Part 3 — "items in the caravan should always be transferred
 * out if the caravan has ended." One line however many caravans have ended,
 * with a single link to them; renders nothing when there are none.
 */
export default function EndedCaravansBanner({
  hostBranchId,
  variant,
  enabled = true,
  onView,
}: Props) {
  const { alerts } = useCaravanAlerts(hostBranchId, enabled)
  const ended = alerts.filter((a) => a.ended && a.unitsHeld > 0)
  if (ended.length === 0) return null

  if (variant === 'pos') {
    return (
      <div className="flex items-center gap-3 border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-800">
        <AlertTriangle size={14} className="shrink-0 text-amber-500" />
        <p>
          <span className="font-medium">{headline(ended)}</span> that can&apos;t be sold. Ask your
          stock controller to transfer them out.
        </p>
      </div>
    )
  }

  // One caravan opens straight onto it; several open the Caravan view.
  const single = ended.length === 1 ? ended[0].id : undefined
  const label = single ? 'View caravan' : 'View caravans'
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 rounded-xl border border-[#f3d7a8] bg-[#fdf6ea] px-4 py-2.5"
    >
      <p className="flex min-w-0 items-center gap-2 text-[13px] text-[#8a4b06]">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>
          <span className="font-semibold">{headline(ended)}</span> to transfer out
        </span>
      </p>
      {onView ? (
        <button
          type="button"
          onClick={() => onView(single)}
          className={`${VIEW_CLASS} text-[12.5px]`}
        >
          {label}
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      ) : (
        <Link
          href={`/inventory/serial-numbers?caravan=${single ?? ALL_CARAVANS}`}
          className={`${VIEW_CLASS} text-[12.5px]`}
        >
          {label}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  )
}
