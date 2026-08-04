'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'

export type CategorySelectOption = { id: string; name: string; depth: number }

type Props = {
  value: string | undefined
  onChange: (value: string | undefined) => void
  options: CategorySelectOption[]
  placeholder?: string
  className?: string
  disabled?: boolean
}

export default function CategorySelect({
  value,
  onChange,
  options,
  placeholder = 'Select category…',
  className = '',
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selected = options.find((o) => o.id === value)

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [])

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center justify-between rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500 disabled:cursor-not-allowed disabled:opacity-50 ${
          open ? 'border-prominent-purple-500 ring-1 ring-prominent-purple-500' : ''
        }`}
      >
        <span className={selected ? 'text-zinc-900' : 'text-zinc-400'}>
          {selected ? selected.name : placeholder}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
          <button
            type="button"
            onClick={() => {
              onChange(undefined)
              setOpen(false)
            }}
            className="flex w-full items-center px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-50"
          >
            {placeholder}
          </button>
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                onChange(opt.id)
                setOpen(false)
              }}
              className={`flex w-full items-center gap-2 py-2 pr-3 text-sm transition-colors hover:bg-zinc-50 ${
                opt.id === value
                  ? 'bg-prominent-purple-50 text-prominent-purple-700'
                  : 'text-zinc-800'
              }`}
              style={{ paddingLeft: `${opt.depth * 16 + 12}px` }}
            >
              {opt.depth > 0 && (
                <span className="shrink-0 text-zinc-300">{'—'.repeat(opt.depth)}</span>
              )}
              <span className="flex-1 text-left">{opt.name}</span>
              {opt.id === value && <Check className="h-3.5 w-3.5 shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
