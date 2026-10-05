'use client'

import { useEffect, useRef, useState } from 'react'
import { MoreHorizontal, MoreVertical } from 'lucide-react'
import type { ComponentType } from 'react'

export type RowMenuItem = {
  label: string
  icon?: ComponentType<{ className?: string }>
  onClick: () => void
  /** `danger` for a destructive action, `success` for one that commits or
   * posts something. Both only colour the row — neither changes behaviour. */
  variant?: 'danger' | 'success'
}

type DropdownPos = { top: number; right: number }

/**
 * Overflow menu for a table row's (or card's) secondary actions — keeps a
 * row's primary, time-sensitive actions as direct buttons while collapsing
 * everything else, so a row with many possible actions (e.g. every
 * approval-workflow status at once) doesn't cram 5+ icon buttons in a line.
 * Uses a fixed-position dropdown (not absolute) so it isn't clipped by an
 * ancestor `overflow-x-auto` table container.
 */
export function RowActionsMenu({
  items,
  horizontal = false,
  bordered = false,
}: {
  items: RowMenuItem[]
  /** Three dots in a row (…) instead of a column, for page headers. */
  horizontal?: boolean
  /** Outlined button sized to sit beside the header's other buttons. */
  bordered?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<DropdownPos | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleMouseDown(e: MouseEvent) {
      if (btnRef.current?.contains(e.target as Node) || menuRef.current?.contains(e.target as Node))
        return
      setOpen(false)
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [open])

  function handleToggle() {
    if (!btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    setPos({
      top: rect.bottom + window.scrollY + 4,
      right: window.innerWidth - rect.right,
    })
    setOpen((o) => !o)
  }

  if (items.length === 0) return null

  return (
    <div className="relative inline-block">
      <button
        ref={btnRef}
        type="button"
        onClick={handleToggle}
        className={
          bordered
            ? 'inline-flex items-center rounded-xl border border-gray-200 bg-white px-3 py-2 text-gray-700 hover:bg-gray-50'
            : 'rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700'
        }
        title="More actions"
        aria-label="More actions"
      >
        {horizontal ? <MoreHorizontal className="h-4 w-4" /> : <MoreVertical className="h-4 w-4" />}
      </button>

      {open && pos && (
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 9999 }}
          className="w-max min-w-44 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg"
        >
          {items.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  item.onClick()
                  setOpen(false)
                }}
                className={`flex w-full items-center gap-2 whitespace-nowrap px-3 py-1.5 text-left text-sm ${
                  item.variant === 'danger'
                    ? 'text-red-600 hover:bg-red-50'
                    : item.variant === 'success'
                      ? 'text-emerald-600 hover:bg-emerald-50'
                      : 'text-zinc-700 hover:bg-zinc-50'
                }`}
              >
                {Icon && <Icon className="h-3.5 w-3.5" />}
                {item.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
