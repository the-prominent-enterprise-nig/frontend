'use client'

import { formatManilaDate, formatManilaDateTime } from '@/src/libs/format/manila-date'

const DATE_OPTS: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }
const DATETIME_OPTS: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
}
const SHORT_OPTS: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
}

export function PosDate({ iso }: { iso?: string | null }) {
  if (!iso) return <span suppressHydrationWarning>—</span>
  return <span suppressHydrationWarning>{formatManilaDate(iso, DATE_OPTS)}</span>
}

export function PosDateTime({ iso }: { iso?: string | null }) {
  if (!iso) return <span suppressHydrationWarning>—</span>
  return <span suppressHydrationWarning>{formatManilaDateTime(iso, DATETIME_OPTS)}</span>
}

export function PosDateShort({ iso }: { iso?: string | null }) {
  if (!iso) return <span suppressHydrationWarning>—</span>
  return <span suppressHydrationWarning>{formatManilaDateTime(iso, SHORT_OPTS)}</span>
}
