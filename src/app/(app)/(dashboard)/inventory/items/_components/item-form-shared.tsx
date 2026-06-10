'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronRight } from 'lucide-react'
import type { ItemTagLabel } from '@/src/schema/inventory/items'

export const ALL_TAGS: { value: ItemTagLabel; label: string }[] = [
  { value: 'best_seller', label: 'Best Seller' },
  { value: 'holiday', label: 'Holiday' },
  { value: 'clearance', label: 'Clearance' },
  { value: 'new_arrival', label: 'New Arrival' },
]

export const DIMENSION_FIELDS = [
  { name: 'lengthCm', label: 'Length (cm)', step: '0.1' },
  { name: 'widthCm', label: 'Width (cm)', step: '0.1' },
  { name: 'heightCm', label: 'Height (cm)', step: '0.1' },
  { name: 'weightKg', label: 'Weight (kg)', step: '0.001' },
] as const

const VALID_TAGS: string[] = ALL_TAGS.map((t) => t.value)

export function normalizeTagList(raw: unknown): ItemTagLabel[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((entry: unknown) => (typeof entry === 'string' ? entry : (entry as { tag?: string })?.tag))
    .filter((t): t is ItemTagLabel => typeof t === 'string' && VALID_TAGS.includes(t))
}

export function NumericInput({
  value,
  onChange,
  onBlur,
  fieldRef,
  integer = false,
  ...rest
}: {
  value: number | undefined
  onChange: (v: number | undefined) => void
  onBlur?: () => void
  fieldRef?: React.Ref<HTMLInputElement>
  integer?: boolean
  [key: string]: unknown
}): React.ReactElement {
  const [raw, setRaw] = useState(value != null ? String(value) : '')
  const externalValue = useRef(value)

  useEffect(() => {
    if (value !== externalValue.current) {
      externalValue.current = value
      setRaw(value != null ? String(value) : '')
    }
  }, [value])

  const regex = integer ? /^\d*$/ : /^\d*\.?\d*$/

  return (
    <input
      ref={fieldRef}
      onBlur={onBlur}
      type="text"
      inputMode={integer ? 'numeric' : 'decimal'}
      {...(rest as React.InputHTMLAttributes<HTMLInputElement>)}
      value={raw}
      onChange={(e) => {
        const v = e.target.value
        if (v !== '' && !regex.test(v)) return
        setRaw(v)
        onChange(v === '' ? undefined : integer ? Math.floor(Number(v)) : Number(v))
      }}
    />
  )
}

export function FormSection({
  title,
  children,
  defaultOpen = true,
  errorCount = 0,
  forceOpen = false,
}: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
  errorCount?: number
  forceOpen?: boolean
}): React.ReactElement {
  const [open, setOpen] = useState(defaultOpen)
  const isOpen = forceOpen || open
  return (
    <div className="border-b border-zinc-100 last:border-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-6 py-3.5 text-left hover:bg-zinc-50/80"
      >
        <span className="text-sm font-semibold text-zinc-700">{title}</span>
        <div className="flex items-center gap-2">
          {errorCount > 0 && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">
              {errorCount} error{errorCount !== 1 ? 's' : ''}
            </span>
          )}
          <ChevronRight
            className={`h-4 w-4 text-zinc-400 transition-transform duration-150 ${isOpen ? 'rotate-90' : ''}`}
          />
        </div>
      </button>
      {isOpen && <div className="grid gap-4 px-6 pb-5 pt-1 sm:grid-cols-2">{children}</div>}
    </div>
  )
}
