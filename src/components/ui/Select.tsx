'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Check, ChevronDown, Plus } from 'lucide-react'
import { useOpenUpward } from '@/src/hooks/useOpenUpward'

export type SelectOption = {
  value: string
  label: string
}

type Props = {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  /** Trailing row, visually separated from `options` — for an action like
   * "+ Add new…" that opens something else instead of picking a value. */
  extraAction?: { label: string; onClick: () => void }
  /** Tighter padding/font for dense layouts (e.g. a table row) — everything
   * else about the component stays the same. Off by default so existing
   * usages are unaffected. */
  compact?: boolean
}

/**
 * A custom-rendered dropdown for short, static option lists — native
 * `<select>` popups can't be styled by CSS at all (font, padding, hover
 * states, dividers are all browser/OS-controlled), so anywhere the open
 * list itself needs to look intentional rather than default-browser, this
 * is the alternative. Not built for long/searchable lists — see
 * SearchCombobox for that.
 */
export function Select({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  extraAction,
  compact = false,
}: Props) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const listboxId = useId()
  const openUpward = useOpenUpward(open, containerRef, popupRef)

  useEffect(() => {
    if (!open) return
    function handleMouseDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const selected = options.find((o) => o.value === value)

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        // combobox is a "name from author" role — unlike a plain button, its
        // accessible name isn't computed from visible text content, so it
        // needs an explicit label reflecting the current selection.
        aria-label={selected ? selected.label : placeholder}
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full min-w-0 items-center justify-between rounded-lg border border-zinc-200 bg-white text-left outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500 ${
          compact ? 'px-2.5 py-1.5 text-[13px]' : 'px-3 py-2 text-sm'
        }`}
      >
        <span className={`truncate ${selected ? 'text-zinc-900' : 'text-zinc-400'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          ref={popupRef}
          id={listboxId}
          role="listbox"
          className={`absolute z-50 max-h-60 w-full overflow-y-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg ${
            openUpward ? 'bottom-full mb-1' : 'top-full mt-1'
          }`}
        >
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={o.value === value}
              onClick={() => {
                onChange(o.value)
                setOpen(false)
              }}
              className={`flex w-full items-center justify-between text-left hover:bg-zinc-50 ${
                compact ? 'px-2.5 py-1.5 text-[13px]' : 'px-3 py-2 text-sm'
              } ${o.value === value ? 'font-medium text-prominent-purple-700' : 'text-zinc-800'}`}
            >
              {o.label}
              {o.value === value && <Check className="h-3.5 w-3.5 shrink-0" />}
            </button>
          ))}
          {extraAction && (
            <>
              <div className="my-1 border-t border-zinc-100" />
              <button
                type="button"
                onClick={() => {
                  extraAction.onClick()
                  setOpen(false)
                }}
                className={`flex w-full items-center gap-1.5 text-left text-prominent-purple-700 hover:bg-prominent-purple-50 ${
                  compact ? 'px-2.5 py-1.5 text-[13px]' : 'px-3 py-2 text-sm'
                }`}
              >
                <Plus className="h-3.5 w-3.5 shrink-0" />
                {extraAction.label}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
