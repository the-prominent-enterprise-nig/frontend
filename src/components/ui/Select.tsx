'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Check, ChevronDown, Plus } from 'lucide-react'

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
}

/**
 * A custom-rendered dropdown for short, static option lists — native
 * `<select>` popups can't be styled by CSS at all (font, padding, hover
 * states, dividers are all browser/OS-controlled), so anywhere the open
 * list itself needs to look intentional rather than default-browser, this
 * is the alternative. Not built for long/searchable lists — see
 * SearchCombobox for that.
 */
export function Select({ value, onChange, options, placeholder = 'Select…', extraAction }: Props) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const listboxId = useId()

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
        className="flex w-full items-center justify-between rounded-lg border border-zinc-200 bg-white px-3 py-2 text-left text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
      >
        <span className={selected ? 'text-zinc-900' : 'text-zinc-400'}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg"
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
              className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-zinc-50 ${
                o.value === value ? 'font-medium text-prominent-purple-700' : 'text-zinc-800'
              }`}
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
                className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-sm text-prominent-purple-700 hover:bg-prominent-purple-50"
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
