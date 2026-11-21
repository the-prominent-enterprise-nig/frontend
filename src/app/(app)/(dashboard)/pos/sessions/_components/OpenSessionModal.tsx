'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Loader2, X } from 'lucide-react'
import { useTerminals } from '../../_hooks/usePos'
import { getCurrentSessionUser, searchUsers, verifyCashierPin } from '../../_actions/pos-actions'
import { usePosBranchContext } from '@/src/stores/pos-branch-context.store'
import { Skeleton } from '@/src/components/ui/Skeleton'
import SearchableSelect from '@/src/components/ui/SearchableSelect'
import { terminalPlaceId, terminalPlaceName } from '@/src/libs/format/locationLabel'
import type { OpenSessionInput } from '@/src/schema/pos'

export function Overlay({
  children,
  onClose,
}: {
  children: React.ReactNode
  onClose: () => void
}): React.JSX.Element {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      {/* items-start + my-auto (rather than items-center) keeps a modal taller
          than the viewport fully reachable — with items-center the top of an
          overflowing panel gets clipped out of reach in every browser. This is
          a safety net for small viewports; no modal should need it by default. */}
      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overscroll-contain p-4">
        <div className="relative my-auto w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-gray-400 hover:text-gray-700"
          >
            <X size={18} />
          </button>
          {children}
        </div>
      </div>
    </>
  )
}

export function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-gray-600">{label}</label>
      {children}
    </div>
  )
}

/**
 * Opens a cashier's session: who (signed in by PIN), which terminal, and the
 * float counted into the drawer. Used by the Sessions page and, inline, by
 * Collect Payment when cash is taken at a counter with no session open.
 */
export default function OpenSessionModal({
  error,
  isLoading,
  onClose,
  onSubmit,
  branchId: branchOverride,
  note,
}: {
  error: string
  isLoading: boolean
  onClose: () => void
  onSubmit: (f: OpenSessionInput) => void
  /** The branch whose terminals to offer. Defaults to the POS branch context;
   * Collect Payment passes the branch the collection is being taken at. */
  branchId?: string
  /** A line under the title saying why the session is being opened here. */
  note?: string
}): React.JSX.Element {
  const { branchId: contextBranchId } = usePosBranchContext()
  const branchId = branchOverride ?? contextBranchId
  const { data: terminalsData } = useTerminals(branchId ? { branchId } : undefined)
  // Same rule as the session list: a caravan's terminal is offered under the
  // caravan, not under its host.
  const terminals = (terminalsData?.data ?? []).filter(
    (t) => !branchId || terminalPlaceId(t) === branchId
  )

  // Opening cash is held as a string so the field can show a real "0.00" —
  // a till legitimately opens empty, and a blank box left cashiers unsure
  // whether zero had been accepted or the field simply ignored.
  const [form, setForm] = useState({ terminalId: '', openingCash: '0.00', notes: '' })
  // A branch with one counter has nothing to choose — pick it.
  const onlyTerminalId = terminals.length === 1 ? terminals[0].id : ''
  const terminalId = form.terminalId || onlyTerminalId

  const [filtered, setFiltered] = useState<{ id: string; name: string; email: string }[]>([])
  const [usersError, setUsersError] = useState('')
  const [searching, setSearching] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState<{ id: string; name: string } | null>(null)
  const [pin, setPin] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [verifyError, setVerifyError] = useState('')
  const [verifiedCashier, setVerifiedCashier] = useState<{ id: string; name: string } | null>(null)
  const [autoFilledCashier, setAutoFilledCashier] = useState(false)
  const [loadingCurrentUser, setLoadingCurrentUser] = useState(true)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pinInputRef = useRef<HTMLInputElement | null>(null)

  // Default the sign-in to whoever's logged into this browser session — the
  // common case is a cashier opening their own till. "Not you?" falls back
  // to the search box for shared-terminal / supervisor-assisted sign-ins.
  useEffect(() => {
    let cancelled = false
    getCurrentSessionUser().then((res) => {
      if (cancelled) return
      if (res.success && res.data) {
        setSelectedUser({ id: res.data.id, name: res.data.name })
        setAutoFilledCashier(true)
      }
      setLoadingCurrentUser(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (selectedUser && !verifiedCashier) {
      pinInputRef.current?.focus()
    }
  }, [selectedUser, verifiedCashier])

  // Scope the sign-in search to Cashiers at this terminal's branch (falls
  // back to the branch until a terminal is picked).
  const selectedTerminal = terminals.find((t) => t.id === terminalId)
  const effectiveBranchId = selectedTerminal?.branchId ?? branchId ?? undefined

  useEffect(() => {
    if (!search.trim()) {
      setFiltered([])
      setUsersError('')
      return
    }
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(async () => {
      setSearching(true)
      const res = await searchUsers(search.trim(), effectiveBranchId, 'Branch Cashier')
      if (res.success && Array.isArray(res.data)) {
        setFiltered(res.data)
        setUsersError('')
      } else {
        setFiltered([])
        setUsersError(res.error ?? 'Unable to search cashiers')
      }
      setSearching(false)
    }, 300)
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current)
    }
  }, [search, effectiveBranchId])

  async function handleVerify(): Promise<void> {
    if (!selectedUser) return
    setVerifyError('')
    setVerifying(true)
    const res = await verifyCashierPin(selectedUser.id, pin.trim())
    setVerifying(false)
    if (!res.success || !res.data) {
      setVerifyError(res.error ?? 'Invalid PIN')
      return
    }
    setVerifiedCashier({ id: res.data.id, name: res.data.name })
  }

  function resetCashier(): void {
    setVerifiedCashier(null)
    setSelectedUser(null)
    setSearch('')
    setPin('')
    setVerifyError('')
    setAutoFilledCashier(false)
  }

  const canSubmit = !!verifiedCashier && !!terminalId && !isLoading
  const terminalOptions = terminals.map((t) => ({
    value: t.id,
    label: `${t.caravanBranch ? `${terminalPlaceName(t)} · ` : ''}${t.terminalCode} — ${t.name}`,
  }))

  return (
    <Overlay onClose={onClose}>
      <h2 className="mb-1 text-lg font-bold text-gray-900">Open Session</h2>
      {note && <p className="mb-3 text-sm text-ink-muted">{note}</p>}
      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      <div className="mt-3 space-y-4">
        {/* Cashier sign-in */}
        <div className="space-y-3 rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Cashier Sign-In
          </p>

          {verifiedCashier ? (
            <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2">
              <CheckCircle2 size={15} className="shrink-0 text-green-600" />
              <span className="text-sm font-medium text-green-800">{verifiedCashier.name}</span>
              <button
                onClick={resetCashier}
                className="ml-auto text-xs text-gray-400 hover:text-gray-600"
              >
                Change
              </button>
            </div>
          ) : loadingCurrentUser ? (
            <Skeleton className="h-9 w-full" />
          ) : selectedUser ? (
            <>
              <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                <span className="text-sm font-medium text-gray-800">{selectedUser.name}</span>
                <button
                  onClick={resetCashier}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  {autoFilledCashier ? 'Not you?' : 'Change'}
                </button>
              </div>
              <Field label="PIN">
                <input
                  ref={pinInputRef}
                  className="input"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="4–6 digit PIN"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                />
              </Field>
              {verifyError && <p className="text-xs text-red-600">{verifyError}</p>}
              <button
                onClick={handleVerify}
                disabled={verifying || !pin.trim()}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {verifying ? 'Verifying…' : 'Verify PIN'}
              </button>
            </>
          ) : (
            <Field label="Search by name or email">
              <div className="relative">
                <input
                  className="input"
                  placeholder="Type to search…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {searching && (
                  <Loader2
                    size={14}
                    className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400"
                  />
                )}
                {usersError && <p className="mt-1 text-xs text-red-500">{usersError}</p>}
                {!usersError && search.trim() && !searching && (
                  <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
                    {filtered.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-gray-400">No cashiers found</p>
                    ) : (
                      filtered.slice(0, 6).map((u) => (
                        <button
                          key={u.id}
                          onClick={() => {
                            setSelectedUser({ id: u.id, name: u.name })
                            setSearch('')
                          }}
                          className="flex w-full flex-col px-3 py-2 text-left first:rounded-t-lg last:rounded-b-lg hover:bg-gray-50"
                        >
                          <span className="text-sm font-medium text-gray-800">{u.name}</span>
                          <span className="text-xs text-gray-400">{u.email}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </Field>
          )}
        </div>

        <Field label="Terminal">
          <SearchableSelect
            value={terminalId}
            onChange={(value) => setForm((p) => ({ ...p, terminalId: value ?? '' }))}
            options={terminalOptions}
            placeholder="Select a terminal…"
            ariaLabel="Terminal"
            loading={!terminalsData}
            portal
          />
        </Field>
        <Field label="Opening Cash (₱)">
          <input
            className="input"
            type="number"
            min={0}
            step={0.01}
            value={form.openingCash}
            onChange={(e) => setForm((p) => ({ ...p, openingCash: e.target.value }))}
            onBlur={(e) =>
              setForm((p) => ({ ...p, openingCash: (parseFloat(e.target.value) || 0).toFixed(2) }))
            }
          />
        </Field>
        <Field label="Notes">
          <input
            className="input"
            placeholder="Optional"
            value={form.notes}
            onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
          />
        </Field>
      </div>
      <div className="mt-6 flex justify-end gap-3">
        <button onClick={onClose} className="btn-secondary">
          Cancel
        </button>
        <button
          onClick={() =>
            onSubmit({
              ...form,
              terminalId,
              openingCash: parseFloat(form.openingCash) || 0,
              cashierId: verifiedCashier!.id,
            })
          }
          disabled={!canSubmit}
          className="btn-primary disabled:opacity-50"
        >
          {isLoading ? 'Opening…' : 'Open Session'}
        </button>
      </div>
    </Overlay>
  )
}
