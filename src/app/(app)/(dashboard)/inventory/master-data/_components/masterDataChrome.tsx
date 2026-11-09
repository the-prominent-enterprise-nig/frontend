'use client'

import type { ReactNode } from 'react'
import { Search } from 'lucide-react'
import { STOCK_TABLE_HEAD } from '@/src/libs/design/plex'
import { StatusBadge } from '@/src/components/ui/StatusBadge'

/**
 * The Master Data tabs' list chrome, in the Stock Ledger / Stock Transaction
 * design language (#5b21b6 palette, mono uppercase column heads) so the hubs
 * read as one app.
 */

/** Side padding matches TabNav's (px-4 md:px-6) so the heading lines up with
 * the first tab above it; max width matches the Stock Ledger. */
export const PAGE_SHELL =
  'min-h-full w-full bg-zinc-50 px-4 py-[14px] md:px-6 min-[1080px]:py-[22px]'

export const PAGE_INNER = 'mx-auto max-w-[1560px] space-y-5'

export const PRIMARY_BUTTON =
  'inline-flex items-center gap-1.5 rounded-lg bg-[#5b21b6] px-4 py-[9px] text-[13px] font-medium text-white hover:bg-[#4a189b] disabled:opacity-60'

export const ICON_BUTTON = 'rounded-md p-1.5 text-ink-faint hover:bg-[#f0e9fc] hover:text-[#5b21b6]'

export const TABLE_HEAD_ROW = `border-b border-[#eeeef1] bg-[#fbfbfc] ${STOCK_TABLE_HEAD}`

const ROW_STATUS: Record<string, { label: string; chip: string; dot: string }> = {
  active: { label: 'Active', chip: 'bg-[#e7f5ef] text-[#0b6644]', dot: 'bg-[#0f7b52]' },
  inactive: { label: 'Inactive', chip: 'bg-[#f1f1f4] text-[#4b4b5a]', dot: 'bg-[#8a8a96]' },
}

/** Row status, on the shared StatusBadge. */
export function StatusPill({ status }: { status: string }): ReactNode {
  const meta = ROW_STATUS[status] ?? ROW_STATUS.inactive
  return <StatusBadge label={meta.label} colorClassName={meta.chip} dotClassName={meta.dot} />
}

export function ListHeader({
  title,
  description,
  actions,
}: {
  title: string
  description: string
  actions?: ReactNode
}): ReactNode {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[21px] font-semibold tracking-[-0.015em]">{title}</h1>
        <p className="mt-1 text-sm text-[#4b4b5a]">{description}</p>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}

export function ListSearch({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
}): ReactNode {
  return (
    <div className="relative min-w-[220px] flex-1 sm:max-w-md">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-[#e4e4e9] bg-white py-2 pl-9 pr-3 text-sm outline-none placeholder:text-ink-faint focus:border-[#5b21b6] focus:ring-1 focus:ring-[#5b21b6]"
      />
    </div>
  )
}

export function TableCard({
  fetching,
  children,
}: {
  fetching?: boolean
  children: ReactNode
}): ReactNode {
  return (
    <div
      className={`overflow-hidden rounded-xl border border-[#e4e4e9] bg-white shadow-sm transition-opacity ${fetching ? 'opacity-60' : ''}`}
    >
      {children}
    </div>
  )
}

export function LoadError({ message }: { message: string }): ReactNode {
  return (
    <div className="rounded-lg border border-[#f3c9c5] bg-[#fdeceb] p-4 text-sm font-medium text-[#8f1c14]">
      {message}
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon: ReactNode
  title: string
  hint?: string
  action?: ReactNode
}): ReactNode {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-3 text-ink-faint">{icon}</div>
      <p className="text-sm font-medium text-[#3d3d4a]">{title}</p>
      {hint && <p className="mt-1 max-w-lg text-xs leading-relaxed text-[#4b4b5a]">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
