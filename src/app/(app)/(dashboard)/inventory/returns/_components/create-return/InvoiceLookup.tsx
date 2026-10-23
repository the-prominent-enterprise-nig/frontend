'use client'

import { useEffect, useRef, type KeyboardEvent } from 'react'
import { Loader2, Receipt, X } from 'lucide-react'
import { INPUT } from './returnTokens'

/** Below this the `contains` match on the server is answering a question
 *  nobody asked — one or two characters match most of the sales table. */
const MIN_QUERY = 3
const DEBOUNCE_MS = 350

type Props = {
  /** What is in the box. Held by the screen, not here, so the text survives
   *  this component being swapped between the empty state and the results
   *  panel mid-search. */
  value: string
  onChange: (value: string) => void
  /** The number the purchases currently on screen were found by — the guard
   *  that stops a remount from re-firing a search that already ran. */
  searched: string | null
  isLoading: boolean
  /** Fired debounced, and immediately on Enter. An empty string means the box
   *  was cleared: drop the search rather than run a blank one. */
  onSearch: (invoiceNumber: string) => void
  /** Takes the caret on mount when there is already text in the box — never
   *  when it is empty. The box moves between the empty state and the results
   *  panel as the search settles, and mounting with a number already in it
   *  means it was mid-edit somewhere else a moment ago. */
  focusWhenFilled?: boolean
}

/**
 * The way in for a customer who has no account.
 *
 * A return's customer is nullable precisely for walk-ins, and the backend has
 * always accepted one — but the screen only knew how to start from a named
 * account, so a cash customer holding a receipt had no path through it at all.
 * They are found instead by the paper they brought back.
 *
 * Searched as typed, the same as the customer combobox beside it: the server
 * matches the number as a substring of the SI, the POS transaction number and
 * the AR invoice number, so a partial is already a useful query and making
 * someone press a button to find that out only hid it. The debounce and the
 * three-character floor are what keep that from fanning out across the sales
 * tables on every keystroke.
 */
export default function InvoiceLookup({
  value,
  onChange,
  searched,
  isLoading,
  onSearch,
  focusWhenFilled = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  // Read through a ref so the debounce is keyed on the typing alone. The
  // screen re-renders on every watched form change, and a handler in the
  // dependency list would restart the timer each time — on a busy form, never
  // reaching the end of it.
  const onSearchRef = useRef(onSearch)
  useEffect(() => {
    onSearchRef.current = onSearch
  }, [onSearch])

  useEffect(() => {
    if (!focusWhenFilled) return
    const el = inputRef.current
    if (!el || !el.value) return
    el.focus()
    // Caret to the end — this box is being handed back mid-number.
    el.setSelectionRange(el.value.length, el.value.length)
  }, [focusWhenFilled])

  useEffect(() => {
    const next = value.trim()
    // Already showing this, so nothing to ask for. Also what makes a remount
    // with text already in the box inert.
    if (next === (searched ?? '')) return
    // Too short to search, but long enough to mean the old result is no
    // longer what was asked for — so it is cleared rather than left standing.
    if (next.length > 0 && next.length < MIN_QUERY) {
      if (!searched) return
      onSearchRef.current('')
      return
    }
    const timer = setTimeout(() => onSearchRef.current(next), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [value, searched])

  return (
    <div className="relative w-full max-w-[420px]">
      <Receipt className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8a8a99]" />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
          if (e.key !== 'Enter') return
          // Nested in the return form that wraps the whole screen, so an
          // un-swallowed Enter posts the return instead of searching.
          e.preventDefault()
          const next = value.trim()
          if (next.length >= MIN_QUERY && next !== searched) onSearchRef.current(next)
        }}
        aria-label="Invoice or transaction number"
        placeholder="Search SI, POS or AR invoice number…"
        className={`h-[38px] w-full pl-8 pr-9 ${INPUT} [&::-webkit-search-cancel-button]:appearance-none`}
      />
      {isLoading ? (
        <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-[#8a8a99]" />
      ) : (
        value && (
          <button
            type="button"
            onClick={() => {
              onChange('')
              inputRef.current?.focus()
            }}
            aria-label="Clear the invoice search"
            className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-[#8a8a99] hover:bg-[#f2f2f4] hover:text-[#17171c]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )
      )}
    </div>
  )
}
