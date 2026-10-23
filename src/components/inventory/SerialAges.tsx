import { formatAge } from '@/src/libs/format/date'

type Props = {
  /** When the unit was first received (its original RR). */
  firstReceivedAt?: string | null
  /** When it arrived at the location it's at now. */
  locationSince?: string | null
  /** One line ("RR 5 Mo(s) · Branch 2 Mo(s)") for tight spots like a chip. */
  inline?: boolean
}

/**
 * Scenario 56 — RR age vs branch age. They differ only for a unit that has
 * moved since it was received; for one that never left, both read the same.
 */
export function SerialAges({ firstReceivedAt, locationSince, inline }: Props) {
  if (!firstReceivedAt && !locationSince) return <span className="text-[#c9c9d3]">—</span>
  const rr = firstReceivedAt ? formatAge(firstReceivedAt) : '—'
  const branch = locationSince ? formatAge(locationSince) : '—'
  if (inline) {
    return (
      <span className="whitespace-nowrap">
        RR {rr} · Branch {branch}
      </span>
    )
  }
  return (
    <span className="flex flex-col leading-tight">
      <span>
        <span className="text-[#a3a3b2]">RR</span> {rr}
      </span>
      <span>
        <span className="text-[#a3a3b2]">Branch</span> {branch}
      </span>
    </span>
  )
}
