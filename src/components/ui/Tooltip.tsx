'use client'

import type { ReactNode } from 'react'

// No Tooltip component existed yet (flagged in docs/design-system.md as a
// known gap, "required for icon-only buttons"). That doc's own Radix UI
// recommendation is part of an unapproved full design-system proposal — this
// is a small, dependency-free version instead, using the same hover/opacity
// pattern already proven in SideBar.tsx's collapsed-nav tooltip.
export default function Tooltip({
  label,
  children,
  side = 'top',
  align = 'center',
}: {
  label: string
  children: ReactNode
  side?: 'top' | 'bottom'
  /** Where the bubble sits horizontally relative to the trigger. 'center' is
   * right for most things; use 'start'/'end' when the trigger sits against the
   * edge of a clipping container (an overflow-auto table, say) and a centred
   * bubble would have half of itself cut off. */
  align?: 'center' | 'start' | 'end'
}) {
  const alignClass =
    align === 'start' ? 'left-0' : align === 'end' ? 'right-0' : 'left-1/2 -translate-x-1/2'
  const positionClass =
    side === 'top' ? `bottom-full mb-1.5 ${alignClass}` : `top-full mt-1.5 ${alignClass}`

  return (
    <span className="group/tooltip relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute ${positionClass} z-[70] whitespace-nowrap rounded-md bg-zinc-900 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover/tooltip:opacity-100`}
      >
        {label}
      </span>
    </span>
  )
}
