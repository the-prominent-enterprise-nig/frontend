'use client'

import { useEffect, useId, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Monitor,
  Search,
} from 'lucide-react'
import type { PosSession } from '@/src/schema/pos'
import { formatManilaDateTime } from '@/src/libs/format/manila-date'

/**
 * The first step of every sale: which cashier session it goes into.
 *
 * Testers kept ringing up whole sales, customer and payments included, only
 * to find Confirm would not go through. With two or more open sessions,
 * nothing was selected, and the only sign was a small "Select session…"
 * dropdown in the top bar. Checkout now asks first. The cart only opens once
 * a session is picked, and nothing is guessed for the seller (developer,
 * 2026-11-16), not even when only one is open. Once picked (or opened in
 * POS → Sessions), it is kept for that login until it closes, so this only
 * shows the first time and after a close. The top bar's dropdown changes it.
 *
 * Selling into another cashier's session stays allowed. An owner ringing up
 * on the branch's till is normal (Scenario 64 item 28). A sale keeps no
 * "rung up by" of its own; its cashier is the session's. So picking someone
 * else's session asks once, saying whose drawer the money goes into.
 */
export default function SessionPicker({
  sessions,
  currentUserId,
  labelFor,
  closedNotice,
  onPick,
}: {
  sessions: PosSession[]
  currentUserId: string | null
  labelFor: (s: PosSession) => string
  /** The session in use was closed while checkout was open. */
  closedNotice: boolean
  onPick: (sessionId: string) => void
}) {
  const [confirming, setConfirming] = useState<PosSession | null>(null)
  const ordered = orderSessions(sessions, currentUserId)

  function choose(s: PosSession) {
    if (currentUserId && s.cashierId !== currentUserId) {
      setConfirming(s)
      return
    }
    onPick(s.id)
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-4 bg-zinc-50 p-6 sm:p-10">
      <div
        data-testid="checkout-session-picker"
        className="flex w-full max-w-lg flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8"
      >
        {confirming ? (
          <OtherCashierSessionCheck
            cashierName={confirming.cashier?.name || 'another cashier'}
            onBack={() => setConfirming(null)}
            onConfirm={() => onPick(confirming.id)}
          />
        ) : (
          <>
            <div>
              <p className="text-lg font-bold text-gray-900">Which session is this sale for?</p>
              <p className="mt-1 text-sm text-gray-500">
                Pick one before you start. The sale goes into that cashier&apos;s drawer.
              </p>
            </div>

            {closedNotice && (
              <div
                role="alert"
                className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
              >
                The session you were using has been closed. Pick another one to continue. Your cart
                is still here.
              </div>
            )}

            {/* Many sessions scroll here; the heading and the link stay put. */}
            <div className="-mr-2 flex max-h-[50vh] flex-col gap-2 overflow-y-auto pr-2">
              {ordered.map((s) => {
                const mine = !!currentUserId && s.cashierId === currentUserId
                return (
                  <button
                    key={s.id}
                    type="button"
                    data-testid="checkout-session-option"
                    onClick={() => choose(s)}
                    className="flex w-full items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 text-left transition-colors hover:border-purple-300 hover:bg-purple-50"
                  >
                    <Monitor size={18} className="shrink-0 text-purple-600" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-gray-900">
                        {labelFor(s)}
                      </span>
                      <SessionMeta session={s} mine={mine} />
                    </span>
                    <ChevronRight size={16} className="shrink-0 text-gray-400" />
                  </button>
                )
              })}
            </div>

            <a href="/pos/sessions" className="text-sm font-medium text-purple-700 hover:underline">
              Don&apos;t see your session? Open one in Sessions →
            </a>
          </>
        )}
      </div>
    </div>
  )
}

/** The seller's own sessions first, then newest first. Nothing is selected
 * by it; it only puts the likely pick at the top. */
function orderSessions(sessions: PosSession[], currentUserId: string | null): PosSession[] {
  return [...sessions].sort((a, b) => {
    const mineA = a.cashierId === currentUserId ? 0 : 1
    const mineB = b.cashierId === currentUserId ? 0 : 1
    if (mineA !== mineB) return mineA - mineB
    return new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime()
  })
}

/** Whether a session matches what was typed in a search box: its branch and
 * terminal (the label) or its cashier, every word anywhere, any case. */
function matchesSessionSearch(
  session: PosSession,
  query: string,
  labelFor: (s: PosSession) => string
): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return true
  const haystack = `${labelFor(session)} ${session.cashier?.name ?? ''}`.toLowerCase()
  return words.every((w) => haystack.includes(w))
}

/** "Bago Cashier (you) · Opened Nov 16, 11:27 AM" */
function SessionMeta({ session, mine }: { session: PosSession; mine: boolean }) {
  return (
    <span className="block truncate text-xs text-gray-500">
      {session.cashier?.name || 'Cashier'}
      {mine && <span className="font-medium text-purple-700"> (you)</span>}
      {' · Opened '}
      {formatManilaDateTime(session.openedAt, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })}
    </span>
  )
}

/**
 * The top bar's session dropdown, once a session is picked. Built like the
 * shared Select (a native <select> list can't be styled) with rows that read
 * like the picker's cards. Choosing a session hands it to `onChoose`, which
 * asks first when it is another cashier's.
 */
export function SessionSwitcher({
  sessions,
  currentUserId,
  labelFor,
  value,
  onChoose,
  disabled = false,
}: {
  sessions: PosSession[]
  currentUserId: string | null
  labelFor: (s: PosSession) => string
  value: string
  onChoose: (sessionId: string) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  // What is typed in the list's search box. Emptied whenever the list closes,
  // so it always reopens showing every session.
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const listboxId = useId()

  function close() {
    setOpen(false)
    setQuery('')
  }

  useEffect(() => {
    if (!open) return
    function shut() {
      setOpen(false)
      setQuery('')
    }
    function handleMouseDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) shut()
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') shut()
    }
    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const selected = sessions.find((s) => s.id === value)
  if (!selected) return null
  const selectedMine = !!currentUserId && selected.cashierId === currentUserId
  const selectedText = `${labelFor(selected)} · ${selected.cashier?.name || 'Cashier'}${
    selectedMine ? ' (you)' : ''
  }`
  const visibleSessions = orderSessions(sessions, currentUserId).filter((s) =>
    matchesSessionSearch(s, query, labelFor)
  )

  return (
    <div ref={containerRef} className="relative min-w-0">
      <button
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-label={`Session: ${selectedText}`}
        data-testid="checkout-active-session"
        data-session-id={selected.id}
        disabled={disabled}
        onClick={() => (open ? close() : setOpen(true))}
        className="flex max-w-xs min-w-0 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-left text-sm outline-none transition-colors hover:border-purple-300 focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500 disabled:cursor-not-allowed disabled:opacity-50 sm:max-w-sm"
      >
        <Monitor size={14} className="shrink-0 text-purple-600" />
        <span className="truncate text-zinc-900">{selectedText}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && !disabled && (
        <div className="absolute left-0 top-full z-50 mt-1 flex w-80 max-w-[calc(100vw-2rem)] flex-col rounded-xl border border-zinc-200 bg-white shadow-lg">
          {/* Typing filters straight away: the box has focus as the list opens. */}
          <div className="border-b border-zinc-100 p-2">
            <div className="relative">
              <Search
                size={14}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400"
              />
              <input
                autoFocus
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search branch, terminal or cashier"
                aria-label="Search sessions"
                data-testid="checkout-session-search"
                className="w-full rounded-lg border border-zinc-200 py-1.5 pl-8 pr-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
              />
            </div>
          </div>
          <div id={listboxId} role="listbox" className="max-h-72 overflow-y-auto p-1">
            {visibleSessions.length === 0 && (
              <p className="px-3 py-4 text-center text-sm text-zinc-500">
                No sessions match &ldquo;{query.trim()}&rdquo;
              </p>
            )}
            {visibleSessions.map((s) => {
              const isSelected = s.id === value
              return (
                <button
                  key={s.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  data-testid="checkout-session-switch-option"
                  onClick={() => {
                    close()
                    if (!isSelected) onChoose(s.id)
                  }}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-purple-50 ${
                    isSelected ? 'bg-purple-50' : ''
                  }`}
                >
                  <Monitor size={16} className="shrink-0 text-purple-600" />
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-sm font-semibold ${
                        isSelected ? 'text-prominent-purple-700' : 'text-gray-900'
                      }`}
                    >
                      {labelFor(s)}
                    </span>
                    <SessionMeta
                      session={s}
                      mine={!!currentUserId && s.cashierId === currentUserId}
                    />
                  </span>
                  {isSelected && <Check className="h-4 w-4 shrink-0 text-prominent-purple-700" />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

/** Asked before using another cashier's session, from the picker and from
 * the top-bar dropdown alike: the money goes into their drawer. */
export function OtherCashierSessionCheck({
  cashierName,
  onBack,
  onConfirm,
}: {
  cashierName: string
  onBack: () => void
  onConfirm: () => void
}) {
  return (
    <div data-testid="checkout-session-confirm" className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-50">
          <AlertTriangle size={20} className="text-amber-500" />
        </div>
        <div>
          <p className="text-lg font-bold text-gray-900">This is {cashierName}&apos;s session</p>
          <p className="mt-1 text-sm text-gray-600">
            This sale goes into {cashierName}&apos;s drawer.
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onBack}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeft size={14} /> Back
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="flex-1 rounded-xl bg-purple-700 py-3 text-sm font-bold text-white hover:bg-purple-800"
        >
          Use this session
        </button>
      </div>
    </div>
  )
}
