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
}: {
  label: string
  children: ReactNode
  side?: 'top' | 'bottom'
}) {
  const positionClass =
    side === 'top'
      ? 'bottom-full left-1/2 mb-1.5 -translate-x-1/2'
      : 'top-full left-1/2 mt-1.5 -translate-x-1/2'

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
