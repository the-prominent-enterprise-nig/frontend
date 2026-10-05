'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

/*
 * The checkout's pill-shaped pickers — the sale's Payment Mode (bank, gateway,
 * card acquirer, card term) and the delivery fee's Paid with use the same
 * ones, so the two read alike.
 */

// Dropdown that reads as clickable: white field, purple border, visible
// chevron. Tinted purple once a value is chosen.
export function PillSelect({
  filled,
  wrapperClassName = '',
  className = '',
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  filled: boolean
  wrapperClassName?: string
}) {
  return (
    <div className={`relative ${wrapperClassName}`}>
      <select
        {...props}
        className={`w-full cursor-pointer appearance-none rounded-lg border-2 py-2.5 pl-3 pr-10 text-[13px] font-semibold shadow-sm outline-none transition-colors hover:border-purple-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 ${
          filled
            ? 'border-purple-300 bg-purple-50 text-purple-800'
            : 'border-purple-200 bg-white text-gray-600'
        } ${className}`}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-purple-500"
      />
    </div>
  )
}

// Searchable version of PillSelect: type to filter, arrows + Enter to pick.
export function PillCombobox({
  options,
  value,
  onChange,
  placeholder,
  ariaLabel,
  wrapperClassName = '',
}: {
  options: { value: string; label: string }[]
  value: string | undefined
  onChange: (value: string | undefined) => void
  placeholder: string
  ariaLabel: string
  wrapperClassName?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const selected = options.find((o) => o.value === value)
  const q = query.trim().toLowerCase()
  const filtered = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  function pick(v: string | undefined) {
    onChange(v)
    setOpen(false)
    setQuery('')
  }

  return (
    <div ref={rootRef} className={`relative ${wrapperClassName}`}>
      <input
        type="text"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        autoComplete="off"
        value={open ? query : (selected?.label ?? '')}
        placeholder={open && selected ? selected.label : placeholder}
        onFocus={() => {
          setOpen(true)
          setActive(0)
        }}
        onChange={(e) => {
          setQuery(e.target.value)
          setActive(0)
          setOpen(true)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setOpen(true)
            setActive((a) => Math.min(a + 1, filtered.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((a) => Math.max(a - 1, 0))
          } else if (e.key === 'Enter' && open) {
            e.preventDefault()
            if (filtered[active]) pick(filtered[active].value)
          } else if (e.key === 'Escape') {
            setOpen(false)
            setQuery('')
          }
        }}
        className={`w-full cursor-pointer rounded-lg border-2 py-2.5 pl-3 pr-10 text-[13px] font-semibold shadow-sm outline-none transition-colors placeholder:text-gray-600 hover:border-purple-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 ${
          selected && !open
            ? 'border-purple-300 bg-purple-50 text-purple-800'
            : 'border-purple-200 bg-white text-gray-800'
        }`}
      />
      <ChevronDown
        aria-hidden
        className={`pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-purple-500 transition-transform ${open ? 'rotate-180' : ''}`}
      />
      {open && (
        <ul
          role="listbox"
          className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-purple-200 bg-white py-1 shadow-lg"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-[13px] text-gray-400">No matches</li>
          ) : (
            filtered.map((o, i) => (
              <li
                key={o.value}
                role="option"
                aria-selected={o.value === value}
                onMouseDown={(e) => {
                  e.preventDefault()
                  pick(o.value)
                }}
                onMouseEnter={() => setActive(i)}
                className={`cursor-pointer px-3 py-2 text-[13px] font-medium ${
                  i === active ? 'bg-purple-100 text-purple-800' : 'text-gray-700'
                } ${o.value === value ? 'font-semibold' : ''}`}
              >
                {o.label}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
