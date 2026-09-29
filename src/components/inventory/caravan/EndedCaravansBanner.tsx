'use client'

import Link from 'next/link'
import { AlertTriangle, ArrowRight } from 'lucide-react'
import { caravanCountdown, type CaravanAlert } from '@/src/schema/inventory/warehouses'
import { caravanLabel } from '@/src/libs/format/locationLabel'
import { useCaravanAlerts } from './useCaravanAlerts'

type Props = {
  /** Narrows an unrestricted viewer to one host (the POS terminal's branch). */
  hostBranchId?: string | null
  /** 'inventory' links each caravan to its units; 'pos' is a notice only —
   * a cashier can't transfer, so it says who to ask instead. */
  variant: 'inventory' | 'pos'
  enabled?: boolean
  /** Replaces the "View units" link with an in-page action — for the Serial
   * Numbers page itself, where the link would only point back at the page. */
  onView?: (caravanId: string) => void
}

const VIEW_CLASS = 'inline-flex items-center gap-1 font-medium text-[#5b21b6] hover:underline'

function unitsText(n: number): string {
  return `${n} ${n === 1 ? 'unit' : 'units'}`
}

function hostText(alert: CaravanAlert): string {
  return alert.hostBranch ? ` at ${alert.hostBranch.name}` : ''
}

/**
 * Scenario 60 Part 3 — "items in the caravan should always be transferred
 * out if the caravan has ended." Lists every ended caravan still holding
 * stock; renders nothing when there are none.
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
      <div className="flex items-start gap-3 border-b border-amber-200 bg-amber-50 px-5 py-3">
        <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-500" />
        <div className="text-sm text-amber-800">
          {ended.map((a) => (
            <p key={a.id}>
              <span className="font-medium">{caravanLabel(a)}</span> has ended —{' '}
              {unitsText(a.unitsHeld)} still there can&apos;t be sold. Ask your stock controller to
              transfer them out.
            </p>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div
      role="alert"
      className="flex flex-col gap-2 rounded-xl border border-[#f3d7a8] bg-[#fdf6ea] px-4 py-3"
    >
      <div className="flex items-center gap-2 text-[13px] font-semibold text-[#8a4b06]">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        {ended.length === 1
          ? 'An ended caravan still holds stock'
          : `${ended.length} ended caravans still hold stock`}
      </div>
      <ul className="flex flex-col gap-1.5">
        {ended.map((a) => (
          <li
            key={a.id}
            className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[12.5px] text-[#5b3a0a]"
          >
            <span>
              <span className="font-medium">{caravanLabel(a)}</span>
              {hostText(a)} · {caravanCountdown(a.endDate)} · {unitsText(a.unitsHeld)} to transfer
              out
            </span>
            {onView ? (
              <button type="button" onClick={() => onView(a.id)} className={VIEW_CLASS}>
                View units
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <Link href={`/inventory/serial-numbers?caravan=${a.id}`} className={VIEW_CLASS}>
                View units
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
