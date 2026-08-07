'use client'

import { useEffect, useRef, useState } from 'react'
import { MoreVertical } from 'lucide-react'
import type { ComponentType } from 'react'

export type RowMenuItem = {
  label: string
  icon: ComponentType<{ className?: string }>
  onClick: () => void
  variant?: 'danger'
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
export function RowActionsMenu({ items }: { items: RowMenuItem[] }) {
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
        className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
        title="More actions"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {open && pos && (
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 9999 }}
          className="w-44 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg"
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
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm ${
                  item.variant === 'danger'
                    ? 'text-red-600 hover:bg-red-50'
                    : 'text-zinc-700 hover:bg-zinc-50'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
