'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, X } from 'lucide-react'
import { Expenses, type SpecialAccountRow } from '@/src/libs/data/AccountingV2Data'
import { accountingCustomersApi } from '@/src/libs/api/crm'

const fmtMoney = (n: number) =>
  `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export type SpecialAccountValue = {
  /** The name the balance is carried against. Stored on the line as `payee`. */
  name: string
  /** The customer this line collects from, when the name is a customer we
   * know. Set together with the name, never on its own. */
  customerId: string
  customerLabel: string
}

type Props = {
  value: SpecialAccountValue
  onChange: (value: SpecialAccountValue) => void
  /** The line's account. Suggestions are scoped to it: the same person can be
   * carried under an advance and a loan at once, and conflating the two
   * balances would hide one behind the other. */
  accountId: string
  /** True when the account keeps no subsidiary ledger — nothing to pick. */
  disabled?: boolean
}

/**
 * Picks which named balance an expense line belongs to, under whichever
 * control account the Account picker chose.
 *
 * One control, not two. A matched customer is shown *as* the value rather
 * than in a second field beside it, so the row stays one line tall — and it
 * has to be cleared before a different one can be picked, which makes
 * replacing a match deliberate rather than a stray keystroke.
 *
 * Editable because the suggestion list is derived from recorded lines: a
 * person's very first advance can never already be in it. The client's own
 * tool works the same way — typed once, offered from then on.
 */
export function SpecialAccountPicker({ value, onChange, accountId, disabled }: Props) {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<SpecialAccountRow[]>([])
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)

  const linked = Boolean(value.customerId)

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      const target = e.target as Node
      if (!containerRef.current?.contains(target) && !popupRef.current?.contains(target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [])

  // Debounced, and only while the list is actually on screen. A linked
  // customer means nothing to search for until it is cleared.
  useEffect(() => {
    if (!open || !accountId || linked) return
    let cancelled = false
    const query = value.name.trim()
    setLoading(true)
    const t = setTimeout(async () => {
      const [register, matches] = await Promise.all([
        Expenses.specialAccounts({ accountId, search: query || undefined }).catch(() => null),
        query.length >= 2 ? accountingCustomersApi.search(query).catch(() => null) : null,
      ])
      if (cancelled) return
      setRows(register?.data?.rows ?? [])
      setCustomers(((matches?.data ?? []) as { id: string; name: string }[]).slice(0, 6))
      setLoading(false)
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [open, accountId, value.name, linked])

  const [position, setPosition] = useState<{
    top: number
    left: number
    width: number
  } | null>(null)

  const updatePosition = useCallback(() => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    setPosition({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 280) })
  }, [])

  // Portalled for the same reason CategorySelect is: the line grid scrolls,
  // and an absolutely positioned popup would be clipped by it.
  useEffect(() => {
    if (!open) return
    updatePosition()
    window.addEventListener('resize', updatePosition)
    document.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      document.removeEventListener('scroll', updatePosition, true)
    }
  }, [open, updatePosition])

  const clear = () => {
    onChange({ name: '', customerId: '', customerLabel: '' })
    setOpen(false)
  }

  const exact = rows.some((r) => r.name.toLowerCase() === value.name.trim().toLowerCase())

  return (
    <div ref={containerRef} className="relative min-w-0">
      <div className="relative">
        <input
          aria-label="Special Account"
          value={linked ? value.customerLabel || value.name : value.name}
          disabled={disabled}
          readOnly={linked}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
          onFocus={() => !linked && setOpen(true)}
          placeholder={disabled ? '—' : 'Name or project'}
          title={disabled ? 'This account keeps no per-name ledger' : value.name || undefined}
          className={`w-full truncate rounded-lg border px-2.5 py-1.5 text-[13px] outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500 ${
            linked
              ? 'border-prominent-purple-200 bg-prominent-purple-50/50 pr-7 text-prominent-purple-900'
              : 'border-zinc-200'
          } ${disabled ? 'cursor-not-allowed bg-zinc-50 text-zinc-400' : ''}`}
        />
        {linked && !disabled && (
          <button
            type="button"
            aria-label="Remove linked customer"
            onClick={clear}
            title="Remove — then a different name can be picked"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-prominent-purple-400 hover:bg-prominent-purple-100 hover:text-prominent-purple-700"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {linked && (
        <p className="mt-0.5 text-[10px] text-prominent-purple-500">Settles their instalments</p>
      )}

      {open &&
        !linked &&
        !disabled &&
        accountId &&
        position &&
        createPortal(
          <div
            ref={popupRef}
            style={{ top: position.top, left: position.left, width: position.width }}
            className="fixed z-100 max-h-72 overflow-y-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg"
          >
            {loading && (
              <div className="flex items-center gap-2 px-3 py-2 text-[12px] text-zinc-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…
              </div>
            )}

            {!loading && rows.length > 0 && (
              <p className="px-3 pb-0.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                Balances on this account
              </p>
            )}
            {!loading &&
              rows.map((r) => (
                <button
                  key={`${r.controlAccount.id}:${r.name}`}
                  type="button"
                  onClick={() => {
                    onChange({ name: r.name, customerId: '', customerLabel: '' })
                    setOpen(false)
                  }}
                  className="flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-[13px] hover:bg-prominent-purple-50"
                >
                  <span className="min-w-0 truncate text-zinc-700">{r.name}</span>
                  {/* The running balance, the way the client's own tool shows
                      it — the reason to pick an existing name over retyping. */}
                  <span className="shrink-0 text-[12px] text-zinc-400">{fmtMoney(r.balance)}</span>
                </button>
              ))}

            {!loading && customers.length > 0 && (
              <p className="border-t border-zinc-100 px-3 pb-0.5 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                Customers — links the deduction to their instalments
              </p>
            )}
            {!loading &&
              customers.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    onChange({ name: c.name, customerId: c.id, customerLabel: c.name })
                    setOpen(false)
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-zinc-700 hover:bg-prominent-purple-50"
                >
                  <span className="min-w-0 truncate">{c.name}</span>
                </button>
              ))}

            {!loading && rows.length === 0 && customers.length === 0 && (
              <p className="px-3 py-2 text-[12px] text-zinc-400">
                No balance carried here yet — type a name to start one.
              </p>
            )}
            {!loading && value.name.trim() && !exact && (
              <p className="border-t border-zinc-100 px-3 py-1.5 text-[11px] text-zinc-500">
                “{value.name.trim()}” will start a new balance under this account.
              </p>
            )}
          </div>,
          document.body
        )}
    </div>
  )
}
