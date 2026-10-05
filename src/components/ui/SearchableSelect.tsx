'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type HTMLAttributes } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check, X } from 'lucide-react'

/** Matches the in-flow dropdown's max-h-56; the portalled one shrinks below
 * this when the chosen side has less room. */
const DROPDOWN_MAX_HEIGHT = 224
const MIN_DROPDOWN_HEIGHT = 120

export type SearchableSelectOption = {
  value: string
  label: string
  /** Options sharing a group sit under one small heading. Pass them already
   * ordered by group — a heading is drawn wherever the group changes. */
  group?: string
}

/** Same label ignoring case; and for numbers, the same number ("09" = "9"). */
function sameLabel(label: string, typed: string): boolean {
  const l = label.trim().toLowerCase()
  if (l === typed) return true
  return /^\d+$/.test(l) && /^\d+$/.test(typed) && Number(l) === Number(typed)
}

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
  /** On Tab or a click elsewhere, keep what was TYPED when it names exactly
   * one option: an exact label (ignoring case, and "09" = "9" for numbers),
   * or the only option the filter has left. Without it, typed text only
   * counts once Enter or a click picks an option, and leaving the field
   * throws it away without a word — a birthday typed "21", Tab, "1990" was
   * saved as no birthday at all. Single-select only; off by default so the
   * existing usages are untouched. */
  commitOnBlur?: boolean
  /** 'start' keeps options whose label BEGINS with the typed text, so "2"
   * offers 2 and 20–29 instead of also 12 and 22, and "19" in a list of years
   * offers 1900–1999 rather than leading with 2019. Defaults to 'anywhere'. */
  matchFrom?: 'anywhere' | 'start'
  /** Passed to the input: 'numeric' brings up the number pad on a tablet. */
  inputMode?: HTMLAttributes<HTMLInputElement>['inputMode']
}

/** Why a single-select changed: picked from the list (a click, or Enter), or
 * kept from typed text as the user left the field (commitOnBlur). A caller
 * that moves focus on a pick should not do it on a blur — the user is
 * already going somewhere else. */
export type SearchableSelectChangeReason = 'select' | 'blur'

type SingleProps = BaseProps & {
  multiple?: false
  value: string
  onChange: (value: string, reason: SearchableSelectChangeReason) => void
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
    commitOnBlur = false,
    matchFrom = 'anywhere',
    inputMode,
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
    props.onChange(optValue, 'select')
    setQuery('')
    setQuerySeeded(false)
    setOpen(false)
  }

  function clear() {
    if (props.multiple) props.onChange([])
    else props.onChange('', 'select')
    setQuery('')
    setQuerySeeded(false)
    setOpen(false)
  }

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      const target = e.target as Node
      // dropdownRef too, not just containerRef: when portalled, the list is
      // no longer a descendant of the trigger, so checking only the trigger
      // would close it on its own options.
      if (!containerRef.current?.contains(target) && !dropdownRef.current?.contains(target)) {
        closeOnLeaveRef.current()
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
    // A freshly-reopened field re-seeds `query` with the current selection's
    // own label (see the input's onFocus below) so the box doesn't look
    // cleared — filtering on that exact seed before the user has typed
    // anything would hide every OTHER option, which is wrong for a field
    // with just a couple of options that don't share substrings (e.g.
    // "VAT inclusive" / "VAT exclusive": reopening on "inclusive" hid
    // "exclusive" entirely). `querySeeded` records that the text was seeded
    // rather than typed, so the list stays complete until a real keystroke
    // clears the flag — which also keeps filtering working when someone
    // deliberately types a label matching the current selection, where
    // comparing the query against that label alone would not.
    if (querySeeded) return options
    const q = query.trim().toLowerCase()
    if (!q) return options
    if (matchFrom === 'start') {
      // Leading zeros dropped for a number, so "09" still finds 9.
      const prefix = /^\d+$/.test(q) ? q.replace(/^0+(?=\d)/, '') : q
      return options.filter((o) => o.label.toLowerCase().startsWith(prefix))
    }
    return options.filter((o) => o.label.toLowerCase().includes(q))
  }, [options, query, querySeeded, matchFrom])

  /** The option the typed text unambiguously names, if any — see
   * commitOnBlur. Never for seeded text: that is the current selection
   * redisplayed, not something the user typed. */
  function typedMatch(): SearchableSelectOption | undefined {
    if (multiple || querySeeded) return undefined
    const q = query.trim().toLowerCase()
    if (!q) return undefined
    const exact = options.find((o) => sameLabel(o.label, q))
    if (exact) return exact
    return filtered.length === 1 ? filtered[0] : undefined
  }

  /** Leaving the field — Tab, or a click outside it. Closes the list, and
   * with commitOnBlur keeps what was typed when it names one option. */
  function closeOnLeave() {
    if (open && commitOnBlur && !props.multiple) {
      const match = typedMatch()
      if (match && match.value !== props.value) props.onChange(match.value, 'blur')
    }
    setOpen(false)
    setQuery('')
    setQuerySeeded(false)
  }
  // The outside-click listener is registered once, so it reaches the latest
  // render's closeOnLeave (and the query it closes over) through this ref.
  const closeOnLeaveRef = useRef(closeOnLeave)
  useEffect(() => {
    closeOnLeaveRef.current = closeOnLeave
  })

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
          inputMode={inputMode}
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
              // With commitOnBlur, an exact label wins over whichever option
              // happens to be listed first.
              const pick = (commitOnBlur ? typedMatch() : undefined) ?? filtered[0]
              if (pick) toggle(pick.value)
              return
            }
            // Tab leaves the field: keep what was typed (commitOnBlur only —
            // other usages keep their existing behaviour) and close the list
            // rather than leaving it open over the next field.
            if (e.key === 'Tab' && commitOnBlur) {
              closeOnLeave()
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
          filtered.map((opt, i) => (
            <div key={opt.value}>
              {opt.group && opt.group !== filtered[i - 1]?.group && (
                <p className="px-3 pb-1 pt-2 text-[10.5px] font-medium uppercase tracking-wide text-gray-400">
                  {opt.group}
                </p>
              )}
              <button
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
            </div>
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
