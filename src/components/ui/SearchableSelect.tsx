'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check, X } from 'lucide-react'

/** Matches the in-flow dropdown's max-h-56; the portalled one shrinks below
 * this when the chosen side has less room. */
const DROPDOWN_MAX_HEIGHT = 224
const MIN_DROPDOWN_HEIGHT = 120

export type SearchableSelectOption = { value: string; label: string }

type BaseProps = {
  options: SearchableSelectOption[]
  placeholder?: string
  loadingLabel?: string
  loading?: boolean
  disabled?: boolean
  className?: string
  /** Border + focus chrome for the control box, for screens that carry their
   * own palette rather than the app brand tokens (the Purchase Orders design
   * uses #5b21b6 on #d3d3db, so a default-styled picker beside its search box
   * reads as a different control). Defaults to the brand chrome. */
  chrome?: { idle: string; focused: string }
  /** Shows a small "×" to reset back to no selection once a value is picked
   * — there's otherwise no way back to the placeholder state from inside
   * the control itself (picking a different option is the only other way
   * `value` ever changes). Off by default since not every consumer wants a
   * "no selection" state to be reachable (e.g. a required field). */
  clearable?: boolean
  /** Renders the option list into <body> at the trigger's coordinates,
   * flipping above when there's no room below, instead of as an absolutely
   * positioned child. Opt-in because it only matters inside a clipping
   * ancestor: in a scrollable container (a modal body, a table) the in-flow
   * list is clipped and grows the container's scroll height rather than
   * floating over it. Same technique SearchCombobox and CategorySelect use.
   * Off by default so the 20-odd existing usages are untouched. */
  portal?: boolean
}

type SingleProps = BaseProps & {
  multiple?: false
  value: string
  onChange: (value: string) => void
}

/** Scenario 50 — the Stock Balance "Branches" filter needs several locations
 * at once. Same control, same type-ahead: the list stays open while picking
 * and the box summarises the count once more than one is selected. */
type MultiProps = BaseProps & {
  multiple: true
  value: string[]
  onChange: (value: string[]) => void
  /** How the box reads with several picked, e.g. "3 branches". Defaults to
   * "N selected". */
  summaryNoun?: string
}

type Props = SingleProps | MultiProps

/** Type-ahead select — typing filters the option list (like Shopee/Lazada's
 * address pickers), rather than a plain native <select> the user has to
 * scroll through. */
export default function SearchableSelect(props: Props) {
  const {
    options,
    placeholder = 'Select…',
    loadingLabel = 'Loading…',
    loading = false,
    disabled = false,
    className = '',
    clearable = false,
    portal = false,
    chrome = {
      idle: 'border-gray-200',
      focused: 'border-prominent-purple-500 ring-1 ring-prominent-purple-500',
    },
  } = props
  const multiple = props.multiple === true

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [position, setPosition] = useState<{
    top?: number
    bottom?: number
    left: number
    width: number
    maxHeight: number
  } | null>(null)

  // Both modes are driven off one array internally so the option list, the
  // filter and the keyboard/mouse behaviour stay identical between them.
  const selectedValues = useMemo(
    () => (multiple ? props.value : props.value ? [props.value] : []),
    [multiple, props.value]
  )
  const isSelected = (optValue: string) => selectedValues.includes(optValue)
  const hasValue = selectedValues.length > 0

  const selected = options.find((o) => o.value === selectedValues[0])

  function toggle(optValue: string) {
    if (props.multiple) {
      const next = props.value.includes(optValue)
        ? props.value.filter((v) => v !== optValue)
        : [...props.value, optValue]
      props.onChange(next)
      // Deliberately stays open — picking several is the whole point.
      setQuery('')
      return
    }
    props.onChange(optValue)
    setQuery('')
    setOpen(false)
  }

  function clear() {
    if (props.multiple) props.onChange([])
    else props.onChange('')
    setQuery('')
    setOpen(false)
  }

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      const target = e.target as Node
      // dropdownRef too, not just containerRef: when portalled, the list is
      // no longer a descendant of the trigger, so checking only the trigger
      // would close it on its own options.
      if (!containerRef.current?.contains(target) && !dropdownRef.current?.contains(target)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [])

  const updatePosition = useCallback(() => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const spaceBelow = window.innerHeight - rect.bottom - 12
    const spaceAbove = rect.top - 12
    const flip = spaceBelow < DROPDOWN_MAX_HEIGHT && spaceAbove > spaceBelow
    setPosition({
      top: flip ? undefined : rect.bottom + 4,
      bottom: flip ? window.innerHeight - rect.top + 4 : undefined,
      left: rect.left,
      width: rect.width,
      maxHeight: Math.max(
        MIN_DROPDOWN_HEIGHT,
        Math.min(DROPDOWN_MAX_HEIGHT, flip ? spaceAbove : spaceBelow)
      ),
    })
  }, [])

  // Follow the trigger while open — the capture-phase scroll listener catches
  // the modal body scrolling under a dropdown that floats above it.
  useEffect(() => {
    if (!portal || !open) return
    updatePosition()
    window.addEventListener('resize', updatePosition)
    document.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      document.removeEventListener('scroll', updatePosition, true)
    }
  }, [portal, open, updatePosition])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => o.label.toLowerCase().includes(q))
  }, [options, query])

  // With several picked there is no single label to show, so summarise.
  const summaryLabel =
    multiple && selectedValues.length > 1
      ? `${selectedValues.length} ${(props as MultiProps).summaryNoun ?? 'selected'}`
      : (selected?.label ?? '')

  const displayValue = open ? query : summaryLabel

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div
        className={`flex items-center rounded-lg border bg-white pr-2 transition-colors ${
          open ? chrome.focused : chrome.idle
        } ${disabled ? 'bg-gray-50' : ''}`}
      >
        <input
          ref={inputRef}
          value={displayValue}
          disabled={disabled}
          placeholder={loading ? loadingLabel : placeholder}
          onFocus={(e) => {
            // Reopening after a value is already picked used to blank the
            // visible text back to an empty search box — the selection was
            // still held in `value` underneath, but it LOOKED cleared. Seed
            // the query with the current label so it stays visible; typing
            // still overwrites/filters as normal, and selecting all text
            // lets a single keystroke replace it like a typical combobox.
            setQuery(multiple ? '' : (selected?.label ?? ''))
            setOpen(true)
            e.target.select()
          }}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          className="w-full rounded-lg bg-transparent px-3 py-2 text-sm outline-none disabled:cursor-not-allowed disabled:text-gray-400"
        />
        {clearable && hasValue && !disabled && (
          <button
            type="button"
            aria-label="Clear selection"
            onMouseDown={(e) => e.preventDefault()}
            onClick={clear}
            className="shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </div>

      {open && !disabled && renderList()}
    </div>
  )

  function renderList() {
    const list = (
      <div
        ref={dropdownRef}
        style={
          portal && position
            ? {
                top: position.top,
                bottom: position.bottom,
                left: position.left,
                width: position.width,
                maxHeight: position.maxHeight,
              }
            : undefined
        }
        className={
          portal
            ? 'fixed z-100 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg'
            : 'absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg'
        }
      >
        {loading ? (
          <p className="px-3 py-2 text-sm text-gray-400">{loadingLabel}</p>
        ) : filtered.length === 0 ? (
          <p className="px-3 py-2 text-sm text-gray-400">No matches</p>
        ) : (
          filtered.map((opt) => (
            <button
              key={opt.value}
              type="button"
              data-testid="searchable-select-option"
              role={multiple ? 'checkbox' : undefined}
              aria-checked={multiple ? isSelected(opt.value) : undefined}
              onMouseDown={(e) => multiple && e.preventDefault()}
              onClick={() => toggle(opt.value)}
              className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-gray-50 ${
                isSelected(opt.value)
                  ? 'bg-prominent-purple-50 text-prominent-purple-700'
                  : 'text-gray-800'
              }`}
            >
              {opt.label}
              {isSelected(opt.value) && <Check className="h-3.5 w-3.5 shrink-0" />}
            </button>
          ))
        )}
      </div>
    )

    if (!portal) return list
    // Nothing to place the list against until the first measurement lands.
    if (!position) return null
    return createPortal(list, document.body)
  }
}
