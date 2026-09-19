'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Check, X } from 'lucide-react'

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
    chrome = {
      idle: 'border-gray-200',
      focused: 'border-prominent-purple-500 ring-1 ring-prominent-purple-500',
    },
  } = props
  const multiple = props.multiple === true

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  // A query seeded from the current selection is for DISPLAY only — it
  // keeps the chosen label visible in the box, but must not filter the
  // list down to that one option. Reopening should always show everything
  // until the user actually types.
  const [querySeeded, setQuerySeeded] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

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
    setQuerySeeded(false)
    setOpen(false)
  }

  function clear() {
    if (props.multiple) props.onChange([])
    else props.onChange('')
    setQuery('')
    setQuerySeeded(false)
    setOpen(false)
  }

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
        setQuerySeeded(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [])

  const filtered = useMemo(() => {
    if (querySeeded) return options
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => o.label.toLowerCase().includes(q))
  }, [options, query, querySeeded])

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
            setQuerySeeded(!multiple && !!selected)
            setOpen(true)
            e.target.select()
          }}
          onChange={(e) => {
            setQuery(e.target.value)
            setQuerySeeded(false)
            setOpen(true)
          }}
          // onFocus alone couldn't reopen the list: picking an option closes
          // it while the input keeps focus, so a second click fired no focus
          // event and appeared dead until you clicked away and back.
          onClick={() => {
            if (!open) {
              setQuery(multiple ? '' : (selected?.label ?? ''))
              setQuerySeeded(!multiple && !!selected)
              setOpen(true)
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setOpen(false)
              setQuery('')
              setQuerySeeded(false)
              return
            }
            // Enter commits the top match, so a value can be chosen without
            // leaving the keyboard — type "jan", press Enter.
            if (e.key === 'Enter') {
              if (!open) return
              e.preventDefault()
              // Nothing typed yet, so the list is the full set and its first
              // row is unrelated to what's selected — Enter here would swap
              // a chosen March for January. Keep the selection and close.
              if (querySeeded) {
                setOpen(false)
                setQuery('')
                setQuerySeeded(false)
                return
              }
              if (filtered.length > 0) toggle(filtered[0].value)
              return
            }
            if (e.key === 'ArrowDown' && !open) setOpen(true)
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
        {/* A real toggle, not decoration — the chevron reads as the way to
            open the list, so clicking it doing nothing feels broken.
            preventDefault on mousedown keeps the input from blurring first,
            which would otherwise close and immediately reopen the list.
            tabIndex -1 keeps it out of the tab order: the input already is
            the control's focus stop. */}
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          aria-label={open ? 'Close options' : 'Open options'}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            if (open) {
              setOpen(false)
              setQuery('')
              setQuerySeeded(false)
              return
            }
            setQuery(multiple ? '' : (selected?.label ?? ''))
            setQuerySeeded(!multiple && !!selected)
            setOpen(true)
            inputRef.current?.focus()
          }}
          className="shrink-0 rounded p-0.5 text-gray-400 disabled:cursor-not-allowed"
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {open && !disabled && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
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
      )}
    </div>
  )
}
