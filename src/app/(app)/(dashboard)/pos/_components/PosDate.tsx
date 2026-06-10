'use client'

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
  return (
    <span suppressHydrationWarning>
      {new Date(iso.slice(0, 10) + 'T00:00:00').toLocaleDateString('en-PH', DATE_OPTS)}
    </span>
  )
}

export function PosDateTime({ iso }: { iso?: string | null }) {
  if (!iso) return <span suppressHydrationWarning>—</span>
  return (
    <span suppressHydrationWarning>{new Date(iso).toLocaleString('en-PH', DATETIME_OPTS)}</span>
  )
}

export function PosDateShort({ iso }: { iso?: string | null }) {
  if (!iso) return <span suppressHydrationWarning>—</span>
  return <span suppressHydrationWarning>{new Date(iso).toLocaleString('en-PH', SHORT_OPTS)}</span>
}
