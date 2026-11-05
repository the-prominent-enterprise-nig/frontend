'use client'

import { useId, useLayoutEffect, useRef, useState, type ReactElement, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Check, X } from 'lucide-react'
import {
  COUNT_REMARK_TAG_LABELS,
  CountRemarkTagSchema,
  type CountRemarkTag,
} from '@/src/schema/inventory/stock-counts'

export const TAG_ICON: Record<CountRemarkTag, ReactNode> = {
  found_on_main_shelf: <Check className="h-3.5 w-3.5 text-ink-muted" />,
  defective: <X className="h-3.5 w-3.5 text-red-600" />,
  yellowish: <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />,
  lacking_parts: <AlertTriangle className="h-3.5 w-3.5 text-prominent-purple-600" />,
}

const TAGS = CountRemarkTagSchema.options

/** The preset a remark starts with, if any: "Defective — bay 2" is Defective. */
export function tagFor(text: string): CountRemarkTag | undefined {
  const t = text.trim().toLowerCase()
  return TAGS.find((tag) => t.startsWith(COUNT_REMARK_TAG_LABELS[tag].toLowerCase()))
}

/** Presets whose label contains what's typed so far (all of them when empty
 * or once a preset has been picked and more is being added after it). */
function matches(text: string): CountRemarkTag[] {
  const t = text.trim().toLowerCase()
  if (!t || tagFor(text)) return t ? [] : TAGS
  return TAGS.filter((tag) => COUNT_REMARK_TAG_LABELS[tag].toLowerCase().includes(t))
}

type Props = {
  value: string
  onChange: (text: string) => void
  ariaLabel: string
  placeholder: string
  highlight?: boolean
}

/** Where the floating list goes: under the box, or above it near the
 * bottom of the screen. Fixed to the viewport, since the sheet scrolls. */
function useListPosition(open: boolean, anchor: React.RefObject<HTMLDivElement | null>) {
  const [pos, setPos] = useState<{
    top?: number
    bottom?: number
    left: number
    width: number
  } | null>(null)
  useLayoutEffect(() => {
    if (!open) return
    const place = (): void => {
      const r = anchor.current?.getBoundingClientRect()
      if (!r) return
      const above = window.innerHeight - r.bottom < 180
      setPos(
        above
          ? { bottom: window.innerHeight - r.top + 4, left: r.left, width: r.width }
          : { top: r.bottom + 4, left: r.left, width: r.width }
      )
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open, anchor])
  return pos
}

/**
 * A Count Sheet line's Remarks: free text, with the four presets offered
 * as you type (Scenario 87). Pick one, then keep typing the location and
 * reference no. after it if needed.
 */
export default function RemarksInput({
  value,
  onChange,
  ariaLabel,
  placeholder,
  highlight = false,
}: Props): ReactElement {
  const anchor = useRef<HTMLDivElement>(null)
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const options = matches(value)
  const showList = open && options.length > 0
  const pos = useListPosition(showList, anchor)
  const tag = tagFor(value)

  const pick = (option: CountRemarkTag): void => {
    onChange(COUNT_REMARK_TAG_LABELS[option])
    setOpen(false)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (!showList) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const step = e.key === 'ArrowDown' ? 1 : -1
      setActive((i) => (i + step + options.length) % options.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      pick(options[Math.min(active, options.length - 1)])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const list =
    showList && pos ? (
      <ul
        id={listId}
        role="listbox"
        aria-label={`${ariaLabel} suggestions`}
        className="fixed z-[70] max-h-40 overflow-y-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg"
        // Coordinates only exist at runtime (the box can sit anywhere in a
        // scrolling sheet), so they can't be utility classes.
        style={pos}
      >
        {options.map((option, i) => (
          <li
            key={option}
            role="option"
            aria-selected={i === active}
            data-testid="remark-suggestion"
            // mousedown, not click: it lands before the input's blur closes the list.
            onMouseDown={(e) => {
              e.preventDefault()
              pick(option)
            }}
            onMouseEnter={() => setActive(i)}
            className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm ${
              i === active ? 'bg-prominent-purple-50 text-prominent-purple-800' : 'text-zinc-800'
            }`}
          >
            {TAG_ICON[option]}
            {COUNT_REMARK_TAG_LABELS[option]}
          </li>
        ))}
      </ul>
    ) : null

  return (
    <div ref={anchor} className="relative">
      {tag && (
        <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2">
          {TAG_ICON[tag]}
        </span>
      )}
      <input
        value={value}
        maxLength={500}
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
          setActive(0)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        className={`w-full rounded-lg border py-2 pr-3 text-sm outline-none focus:border-prominent-purple-500 ${
          tag ? 'pl-8' : 'pl-3'
        } ${highlight ? 'border-amber-300 bg-amber-50/60' : 'border-zinc-200 bg-white'}`}
      />
      {list && createPortal(list, document.body)}
    </div>
  )
}
