'use client'

import { useState, useEffect, useRef, Fragment } from 'react'
import {
  useSessions,
  useOpenSession,
  useCloseSession,
  useHandoverSession,
  useTerminals,
} from '../_hooks/usePos'
import {
  verifyCashierPin,
  searchUsers,
  getSessionReconciliation,
  getCurrentSessionUser,
} from '../_actions/pos-actions'
import { PosDateTime } from '../_components/PosDate'
import { usePosBranchContext } from '@/src/stores/pos-branch-context.store'
import { Skeleton } from '@/src/components/ui/Skeleton'
import { RefreshCw, Monitor, Plus, X, ChevronDown, CheckCircle2, Loader2 } from 'lucide-react'
import type {
  PosSession,
  OpenSessionInput,
  CloseSessionInput,
  HandoverSessionInput,
  SessionReconciliation,
} from '@/src/schema/pos'
import { useRequirePermission } from '@/src/libs/guards/useRequirePermission'
import { POS_PERMISSIONS } from '@/src/libs/guards/pos-permissions'
import { useMe } from '@/src/hooks/useMe'
import { can } from '@/src/libs/guards/permission'

const statusColor: Record<string, string> = {
  open: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-600',
  handed_over: 'bg-yellow-100 text-yellow-700',
}

function formatCurrency(n: number) {
  // Coerced explicitly: Prisma Decimal fields arrive as strings over JSON, and
  // a string that reaches arithmetic upstream concatenates instead of adding
  // (Scenario 53 Part 2 — "1000" + 0 === "10000"). Number() here means a
  // stray string still renders correctly rather than silently misreporting.
  const parsed = Number(n)
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(
    Number.isFinite(parsed) ? parsed : 0
  )
}

type ModalState =
  | { type: 'none' }
  | { type: 'open' }
  | { type: 'close'; session: PosSession }
  | { type: 'handover'; session: PosSession }
  | { type: 'reconciliation'; session: PosSession; data: SessionReconciliation }

export default function SessionsPage() {
  const { session, status } = useRequirePermission(POS_PERMISSIONS.SESSIONS_READ)
  const [expanded, setExpanded] = useState<string | null>(null)
  const { branchId } = usePosBranchContext()
  const branchFilter = branchId ? { branchId } : undefined
  const { data, isLoading, isFetching, refetch } = useSessions(branchFilter)
  const openMutation = useOpenSession()
  const closeMutation = useCloseSession()
  const handoverMutation = useHandoverSession()

  const [modal, setModal] = useState<ModalState>({ type: 'none' })
  const [error, setError] = useState('')

  if (status !== 'authorized' || !session) return null

  const sessions: PosSession[] = data?.data ?? []

  async function handleOpen(form: OpenSessionInput) {
    setError('')
    const res = await openMutation.mutateAsync(form)
    if (!res.success) {
      setError(res.error ?? 'Failed to open session')
      return
    }
    setModal({ type: 'none' })
  }

  async function handleClose(id: string, form: CloseSessionInput) {
    setError('')
    const res = await closeMutation.mutateAsync({ id, input: form })
    if (!res.success) {
      setError(res.error ?? 'Failed to close session')
      return
    }
    const rec = await getSessionReconciliation(id)
    setModal((prev) => {
      if (rec.success && rec.data && prev.type === 'close') {
        // Scenario 53 Part 2 — no fallbacks. The backend is the only source of
        // these figures; it computes them with the same helper close() uses to
        // post the variance journal entry, so anything derived here could only
        // ever contradict what was actually posted.
        //
        // The fallbacks this replaces did exactly that: the backend's field
        // names never matched what was read here, so every figure fell through
        // to client-side arithmetic, and `openingCash + cashCollected` read a
        // Prisma Decimal serialised as the string "1000", making
        // `"1000" + 0 === "10000"`. A no-sale session opened with ₱1,000
        // reported ₱10,000 expected and a ₱10,000 shortage.
        return {
          type: 'reconciliation',
          session: prev.session,
          data: rec.data,
        }
      }
      return { type: 'none' }
    })
  }

  async function handleHandover(id: string, form: HandoverSessionInput) {
    setError('')
    const res = await handoverMutation.mutateAsync({ id, input: form })
    if (!res.success) {
      setError(res.error ?? 'Failed to handover session')
      return
    }
    setModal({ type: 'none' })
  }

  return (
    <div className="min-h-full bg-zinc-50 px-3 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto max-w-7xl space-y-4 sm:space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Sessions</h1>
            <p className="mt-1 text-sm text-gray-500">Monitor and manage cashier sessions.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-purple-600 hover:bg-purple-50 disabled:opacity-50"
            >
              <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              onClick={() => {
                setError('')
                setModal({ type: 'open' })
              }}
              className="flex items-center gap-2 rounded-lg bg-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-purple-800"
            >
              <Plus size={14} />
              Open Session
            </button>
          </div>
        </div>

        <div className="scroll-fade-x overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          {isLoading ? (
            <table className="min-w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                    Session ID
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                    Branch
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                    Terminal
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                    Cashier
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                    Opened
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                    Status
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase text-gray-500">
                    Opening Cash
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase text-gray-500">
                    Transactions
                  </th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[...Array(6)].map((_, i) => (
                  <tr key={i}>
                    <td className="px-5 py-3">
                      <Skeleton className="h-4 w-24" />
                    </td>
                    <td className="px-5 py-3">
                      <Skeleton className="h-4 w-20" />
                    </td>
                    <td className="px-5 py-3">
                      <Skeleton className="h-4 w-24" />
                    </td>
                    <td className="px-5 py-3">
                      <Skeleton className="h-4 w-28" />
                    </td>
                    <td className="px-5 py-3">
                      <Skeleton className="h-4 w-24" />
                    </td>
                    <td className="px-5 py-3">
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Skeleton className="ml-auto h-4 w-16" />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Skeleton className="ml-auto h-4 w-8" />
                    </td>
                    <td className="px-5 py-3" />
                  </tr>
                ))}
              </tbody>
            </table>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-400">
              <Monitor size={40} />
              <p className="text-sm">No sessions found.</p>
            </div>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="w-8 px-2 py-3" />
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                    Branch
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                    Terminal
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                    Cashier
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                    Opened
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                    Status
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase text-gray-500">
                    Opening Cash
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase text-gray-500">
                    Transactions
                  </th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sessions.map((s) => (
                  <Fragment key={s.id}>
                    <tr
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => setExpanded((prev) => (prev === s.id ? null : s.id))}
                    >
                      <td className="px-2 py-3 text-gray-400">
                        <button
                          type="button"
                          aria-expanded={expanded === s.id}
                          aria-label={
                            expanded === s.id ? 'Hide session detail' : 'Show session detail'
                          }
                          className="cursor-pointer rounded p-1 hover:bg-gray-100 hover:text-gray-700"
                        >
                          <ChevronDown
                            size={15}
                            className={`transition-transform ${expanded === s.id ? 'rotate-180' : ''}`}
                          />
                        </button>
                      </td>
                      <td className="px-5 py-3 text-gray-700">{s.terminal?.branch?.name ?? '—'}</td>
                      <td className="px-5 py-3 font-medium text-gray-800">
                        {s.terminal?.name ?? s.terminalId}
                      </td>
                      <td className="px-5 py-3 text-gray-600">{s.cashier?.name || s.cashierId}</td>
                      <td className="px-5 py-3 text-gray-600">
                        <PosDateTime iso={s.openedAt} />
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor[s.status]}`}
                        >
                          {s.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right text-gray-700">
                        {formatCurrency(s.openingCash)}
                      </td>
                      <td className="px-5 py-3 text-right text-gray-600">
                        {s._count?.transactions ?? 0}
                      </td>
                      <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        {s.status === 'open' && (
                          <div className="flex items-center justify-end gap-3">
                            <button
                              onClick={() => {
                                setError('')
                                setModal({ type: 'handover', session: s })
                              }}
                              className="text-xs font-medium text-yellow-600 hover:underline"
                            >
                              Handover
                            </button>
                            <button
                              onClick={() => {
                                setError('')
                                setModal({ type: 'close', session: s })
                              }}
                              className="text-xs font-medium text-red-600 hover:underline"
                            >
                              Close
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                    {expanded === s.id && (
                      <tr className="bg-gray-50/70">
                        <td colSpan={9} className="px-5 py-4">
                          <SessionDetail session={s} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modal.type === 'open' && (
        <OpenSessionModal
          error={error}
          isLoading={openMutation.isPending}
          onClose={() => setModal({ type: 'none' })}
          onSubmit={handleOpen}
        />
      )}

      {modal.type === 'close' && (
        <CloseSessionModal
          session={modal.session}
          error={error}
          isLoading={closeMutation.isPending}
          onClose={() => setModal({ type: 'none' })}
          onSubmit={(f) => handleClose(modal.session.id, f)}
        />
      )}

      {modal.type === 'handover' && (
        <HandoverModal
          session={modal.session}
          error={error}
          isLoading={handoverMutation.isPending}
          onClose={() => setModal({ type: 'none' })}
          onSubmit={(f) => handleHandover(modal.session.id, f)}
        />
      )}

      {modal.type === 'reconciliation' && (
        <ReconciliationModal
          session={modal.session}
          data={modal.data}
          onClose={() => setModal({ type: 'none' })}
        />
      )}
    </div>
  )
}

function OpenSessionModal({
  error,
  isLoading,
  onClose,
  onSubmit,
}: {
  error: string
  isLoading: boolean
  onClose: () => void
  onSubmit: (f: OpenSessionInput) => void
}) {
  const { branchId } = usePosBranchContext()
  const { data: terminalsData } = useTerminals(branchId ? { branchId } : undefined)
  const terminals = terminalsData?.data ?? []

  // Opening cash is held as a string so the field can show a real "0.00" —
  // a till legitimately opens empty, and a blank box left cashiers unsure
  // whether zero had been accepted or the field simply ignored.
  const [form, setForm] = useState({ terminalId: '', openingCash: '0.00', notes: '' })

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
  // back to the page's branch context until a terminal is picked).
  const selectedTerminal = terminals.find((t) => t.id === form.terminalId)
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
      const res = await searchUsers(search.trim(), effectiveBranchId, 'Cashier')
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

  async function handleVerify() {
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

  function resetCashier() {
    setVerifiedCashier(null)
    setSelectedUser(null)
    setSearch('')
    setPin('')
    setVerifyError('')
    setAutoFilledCashier(false)
  }

  const canSubmit = !!verifiedCashier && !!form.terminalId && !isLoading

  return (
    <Overlay onClose={onClose}>
      <h2 className="mb-4 text-lg font-bold text-gray-900">Open Session</h2>
      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      <div className="space-y-4">
        {/* Cashier sign-in */}
        <div className="rounded-xl border border-gray-200 p-4 space-y-3">
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
                          className="flex w-full flex-col px-3 py-2 text-left hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg"
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
          <div className="relative">
            <select
              className="select"
              value={form.terminalId}
              onChange={(e) => setForm((p) => ({ ...p, terminalId: e.target.value }))}
            >
              <option value="">Select a terminal…</option>
              {terminals.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.terminalCode} — {t.name}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
          </div>
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

// Scenario 53 — extended below ₱20. The grid used to stop there, which made
// any drawer holding coins impossible to declare accurately: a ₱9,273.50
// count had nowhere to put the ₱3 or the ₱0.50. Mirrors the denomination
// block on the client's own Daily Collection Report form, which lists
// 1000/500/200/100/50/20 and then a single lump COINS line.
/** Human label for a PosPaymentMethod key, e.g. bank_transfer -> Bank Transfer. */
function tenderLabel(method: string): string {
  if (method === 'qr') return 'QR / Online'
  if (method === 'tpf') return 'TPF'
  return method
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Scenario 53 — the expanded detail for one session row.
 *
 * Reads only what the session row already carries, so opening a row costs no
 * extra request. Everything below the cash summary comes from the closing
 * record persisted in Part 1, which is null for any session closed before that
 * shipped and for any still open — hence the explicit "not recorded" states
 * rather than rendering a zero that would read as a real counted figure.
 */
function SessionDetail({ session }: { session: PosSession }) {
  const tenders = Object.entries(session.tenderBreakdown ?? {}).filter(([, amount]) => amount !== 0)
  const denominations = Object.entries(session.denominationBreakdown ?? {})
  const isClosed = session.status !== 'open'
  const variance = Number(session.cashVariance ?? 0)

  return (
    <div className="grid gap-5 md:grid-cols-3">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Cash</p>
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">Opening</dt>
            <dd className="tabular-nums text-gray-800">{formatCurrency(session.openingCash)}</dd>
          </div>
          {isClosed ? (
            <>
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">Expected</dt>
                <dd className="tabular-nums text-gray-800">
                  {formatCurrency(Number(session.expectedClosingCash ?? 0))}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">Declared</dt>
                <dd className="tabular-nums text-gray-800">
                  {formatCurrency(Number(session.declaredClosingCash ?? 0))}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-gray-200 pt-1">
                <dt className="font-medium text-gray-600">Variance</dt>
                <dd
                  className={`font-semibold tabular-nums ${
                    Math.abs(variance) < 0.01
                      ? 'text-gray-800'
                      : variance < 0
                        ? 'text-red-600'
                        : 'text-amber-600'
                  }`}
                >
                  {formatCurrency(variance)}
                </dd>
              </div>
            </>
          ) : (
            <p className="pt-1 text-xs text-gray-400">Still open — no closing figures yet.</p>
          )}
        </dl>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Tenders taken
        </p>
        {tenders.length > 0 ? (
          <dl className="space-y-1 text-sm">
            {tenders.map(([method, amount]) => (
              <div key={method} className="flex justify-between gap-4">
                <dt className="text-gray-500">{tenderLabel(method)}</dt>
                <dd className="tabular-nums text-gray-800">{formatCurrency(amount)}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-xs text-gray-400">
            {isClosed ? 'No payments taken this session.' : 'Recorded at close.'}
          </p>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Denomination count
        </p>
        {denominations.length > 0 ? (
          <dl className="space-y-1 text-sm">
            {denominations
              // 'coins' carries an amount rather than a count, so it sorts last
              // instead of into the numeric run.
              .sort(([a], [b]) => (a === 'coins' ? 1 : b === 'coins' ? -1 : Number(b) - Number(a)))
              .map(([denomination, value]) => (
                <div key={denomination} className="flex justify-between gap-4">
                  <dt className="text-gray-500">
                    {denomination === 'coins' ? 'Coins' : `₱${denomination}`}
                    {denomination !== 'coins' && (
                      <span className="ml-1 text-xs text-gray-400">× {value}</span>
                    )}
                  </dt>
                  <dd className="tabular-nums text-gray-800">
                    {formatCurrency(
                      denomination === 'coins' ? value : Number(denomination) * value
                    )}
                  </dd>
                </div>
              ))}
          </dl>
        ) : (
          <p className="text-xs text-gray-400">
            {isClosed ? 'No count recorded for this session.' : 'Recorded at close.'}
          </p>
        )}
        {session.closingNotes && (
          <p className="mt-3 border-t border-gray-200 pt-2 text-xs text-gray-600">
            <span className="font-medium text-gray-500">Note: </span>
            {session.closingNotes}
          </p>
        )}
      </div>
    </div>
  )
}

const DENOMINATIONS = [1000, 500, 200, 100, 50, 20, 10, 5, 1]

/** Pesos with centavos always shown — a drawer total of 9273.5 is ₱9,273.50. */
function peso(amount: number): string {
  return amount.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

// Scenario 38 Gap 3 — the backend rejects a non-zero cash variance with a
// message naming these two required fields; matching on it (rather than a
// dedicated error code) keeps this a plain string check, same shape as the
// backend's own BadRequestException text.
const VARIANCE_OVERRIDE_MARKER = 'managerOverride'

function CloseSessionModal({
  session,
  error,
  isLoading,
  onClose,
  onSubmit,
}: {
  session: PosSession
  error: string
  isLoading: boolean
  onClose: () => void
  onSubmit: (f: CloseSessionInput) => void
}) {
  const [counts, setCounts] = useState<Record<number, number>>(
    Object.fromEntries(DENOMINATIONS.map((d) => [d, 0]))
  )
  // Loose coin as a single peso amount rather than a row per centavo
  // denomination — matches the client form's own COINS line, and no cashier
  // wants to tally 25-sentimo pieces individually.
  const [coins, setCoins] = useState('')
  const [notes, setNotes] = useState('')

  // Manager approval, revealed only once the backend rejects a variance —
  // same search+PIN shape as HandoverModal below.
  const [search, setSearch] = useState('')
  const [filtered, setFiltered] = useState<{ id: string; name: string; email: string }[]>([])
  const [searching, setSearching] = useState(false)
  const [usersError, setUsersError] = useState('')
  const [selectedUser, setSelectedUser] = useState<{ id: string; name: string } | null>(null)
  const [pin, setPin] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [verifyError, setVerifyError] = useState('')
  const [verified, setVerified] = useState<{ id: string; name: string } | null>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const branchId = session.terminal?.branchId
  const needsOverride = error.includes(VARIANCE_OVERRIDE_MARKER)

  // Whoever is already signed in approves their own variance automatically if
  // they hold the override permission — no checkbox, no PIN. The manager
  // search + PIN below exists for the other case: a cashier is at the terminal
  // and a manager walks over to authorise. Challenging an already-authenticated
  // approver for their own approval is pure friction.
  //
  // Without this a Business Owner could not close a session with a variance at
  // all: /users/search filters on `employee: { branchId }` and a Business
  // Owner has no Employee record, so no branch search ever returns them, and
  // the seed only sets a cashierPin on cashier accounts so there is no PIN to
  // enter either. Two separate dead ends for the one role that bypasses every
  // permission check in the app.
  const { data: me } = useMe()
  const selfCanApprove = !!me && can(me, POS_PERMISSIONS.TRANSACTIONS_OVERRIDE)

  const coinsAmount = Math.max(0, parseFloat(coins) || 0)
  const total = DENOMINATIONS.reduce((sum, d) => sum + d * (counts[d] ?? 0), 0) + coinsAmount

  const denominationBreakdown = Object.fromEntries(
    DENOMINATIONS.filter((d) => (counts[d] ?? 0) > 0).map((d) => [String(d), counts[d]])
  )
  // 'coins' carries a peso AMOUNT, unlike every other key which carries a
  // COUNT of that denomination. Deliberate: it reproduces the client form's
  // single COINS line. The backend's count-vs-declared check knows about it.
  if (coinsAmount > 0) denominationBreakdown.coins = coinsAmount

  useEffect(() => {
    if (!search.trim()) {
      setFiltered([])
      setUsersError('')
      return
    }
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(async () => {
      setSearching(true)
      const res = await searchUsers(search.trim(), branchId ?? undefined)
      if (res.success && Array.isArray(res.data)) {
        setFiltered(res.data)
        setUsersError('')
      } else {
        setFiltered([])
        setUsersError(res.error ?? 'Unable to search managers')
      }
      setSearching(false)
    }, 300)
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current)
    }
  }, [search, branchId])

  async function handleVerify() {
    if (!selectedUser) return
    setVerifyError('')
    setVerifying(true)
    const res = await verifyCashierPin(selectedUser.id, pin.trim())
    setVerifying(false)
    if (!res.success || !res.data) {
      setVerifyError(res.error ?? 'Invalid PIN')
      return
    }
    setVerified({ id: res.data.id, name: res.data.name })
  }

  function submit() {
    onSubmit({
      declaredClosingCash: total,
      notes: notes || undefined,
      denominationBreakdown:
        Object.keys(denominationBreakdown).length > 0 ? denominationBreakdown : undefined,
      // Sent on the FIRST submit, not after a rejection — a privileged closer
      // never sees the manager-approval block at all, because the backend
      // never has cause to reject them for a missing override.
      ...(verified
        ? { managerOverride: true, managerUserId: verified.id }
        : selfCanApprove && me
          ? { managerOverride: true, managerUserId: me.id }
          : {}),
    })
  }

  return (
    <Overlay onClose={onClose} size="lg">
      <h2 className="mb-1 text-lg font-bold text-gray-900">Close Session</h2>
      <p className="mb-4 text-sm text-gray-500">
        Terminal: {session.terminal?.name ?? session.terminalId}
      </p>
      {error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {needsOverride
            ? 'Declared cash does not match the expected amount — a manager must approve before this session can close.'
            : error}
        </p>
      )}
      <div className="space-y-4">
        <div>
          <label className="mb-2 block text-xs font-semibold text-gray-600">
            Cash Denomination Count
          </label>
          <div className="overflow-hidden rounded-lg border border-gray-200">
            {/* Two columns, deliberately: nine denominations plus a coins line
                stacked vertically runs past the bottom of a laptop viewport
                once the notes and manager-approval blocks open. Paired up it
                fits on screen whole, so the cashier never scrolls away from
                the running total while counting. */}
            <div className="grid grid-cols-2">
              {DENOMINATIONS.map((d, i) => (
                <div
                  key={d}
                  className={`flex items-center gap-2 border-gray-100 px-3 py-1.5 ${
                    i % 2 === 0 ? 'border-r' : ''
                  } border-b`}
                >
                  <span className="w-11 text-sm font-medium text-gray-700">₱{d}</span>
                  <input
                    className="input w-14 px-1 text-center"
                    type="number"
                    min={0}
                    step={1}
                    aria-label={`${d} peso count`}
                    value={counts[d] === 0 ? '' : counts[d]}
                    onChange={(e) =>
                      setCounts((p) => ({ ...p, [d]: parseInt(e.target.value) || 0 }))
                    }
                  />
                  <span className="flex-1 text-right text-sm tabular-nums text-gray-600">
                    {peso(d * (counts[d] ?? 0))}
                  </span>
                </div>
              ))}
              {/* Coins takes the tenth cell, squaring off the 2x5 grid. A peso
                  amount rather than a count — matches the single lump COINS
                  line on the client's own Daily Collection Report form. */}
              <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-1.5">
                <span className="w-11 text-sm font-medium text-gray-700">Coins</span>
                <input
                  className="input w-14 px-1 text-center"
                  type="number"
                  min={0}
                  step={0.01}
                  inputMode="decimal"
                  placeholder="0.00"
                  aria-label="Loose coin total"
                  value={coins}
                  onChange={(e) => setCoins(e.target.value)}
                />
                <span className="flex-1 text-right text-sm tabular-nums text-gray-600">
                  {peso(coinsAmount)}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between bg-gray-50 px-4 py-2">
              <span className="text-sm font-semibold text-gray-700">Total</span>
              <span className="text-sm font-bold text-gray-900">₱{peso(total)}</span>
            </div>
          </div>
        </div>
        <Field label="Notes">
          <input
            className="input"
            placeholder="Optional"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>

        {needsOverride && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
              Manager Approval Required
            </p>
            {verified ? (
              <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2">
                <CheckCircle2 size={15} className="shrink-0 text-green-600" />
                <span className="text-sm font-medium text-green-800">
                  Approved by {verified.name}
                </span>
                <button
                  onClick={() => {
                    setVerified(null)
                    setSelectedUser(null)
                    setSearch('')
                    setPin('')
                  }}
                  className="ml-auto text-xs text-gray-400 hover:text-gray-600"
                >
                  Change
                </button>
              </div>
            ) : selectedUser ? (
              <>
                <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2">
                  <span className="text-sm font-medium text-gray-800">{selectedUser.name}</span>
                  <button
                    onClick={() => {
                      setSelectedUser(null)
                      setPin('')
                      setVerifyError('')
                    }}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    Change
                  </button>
                </div>
                <Field label="Manager PIN">
                  <input
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
                  className="w-full rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  {verifying ? 'Verifying…' : 'Verify PIN'}
                </button>
              </>
            ) : (
              <>
                <input
                  className="input"
                  placeholder="Search manager by name or email…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {searching && <p className="text-xs text-gray-400">Searching…</p>}
                {usersError && <p className="text-xs text-red-600">{usersError}</p>}
                {filtered.length > 0 && (
                  <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                    {filtered.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => setSelectedUser({ id: u.id, name: u.name })}
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                      >
                        {u.name} <span className="text-xs text-gray-400">{u.email}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
      <div className="mt-6 flex justify-end gap-3">
        <button onClick={onClose} className="btn-secondary">
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={isLoading || (needsOverride && !verified)}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {isLoading ? 'Closing…' : `Close Session (₱${peso(total)})`}
        </button>
      </div>
    </Overlay>
  )
}

function HandoverModal({
  session,
  error,
  isLoading,
  onClose,
  onSubmit,
}: {
  session: PosSession
  error: string
  isLoading: boolean
  onClose: () => void
  onSubmit: (f: HandoverSessionInput) => void
}) {
  const [filtered, setFiltered] = useState<{ id: string; name: string; email: string }[]>([])
  const [usersError, setUsersError] = useState('')
  const [searching, setSearching] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState<{ id: string; name: string } | null>(null)
  const [pin, setPin] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [verifyError, setVerifyError] = useState('')
  const [verified, setVerified] = useState<{ id: string; name: string } | null>(null)
  const [declaredCash, setDeclaredCash] = useState(0)
  const [notes, setNotes] = useState('')
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const branchId = session.terminal?.branchId

  useEffect(() => {
    if (!search.trim()) {
      setFiltered([])
      setUsersError('')
      return
    }
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(async () => {
      setSearching(true)
      const res = await searchUsers(search.trim(), branchId ?? undefined, 'Cashier')
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
  }, [search, branchId])

  async function handleVerify() {
    if (!selectedUser) return
    setVerifyError('')
    setVerifying(true)
    const res = await verifyCashierPin(selectedUser.id, pin.trim())
    setVerifying(false)
    if (!res.success || !res.data) {
      setVerifyError(res.error ?? 'Invalid PIN')
      return
    }
    setVerified({ id: res.data.id, name: res.data.name })
  }

  function resetSelection() {
    setVerified(null)
    setSelectedUser(null)
    setSearch('')
    setPin('')
    setVerifyError('')
  }

  return (
    <Overlay onClose={onClose}>
      <h2 className="mb-1 text-lg font-bold text-gray-900">Handover Session</h2>
      <p className="mb-4 text-sm text-gray-500">
        Terminal: {session.terminal?.name ?? session.terminalId}
      </p>

      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <div className="space-y-4">
        <div className="rounded-xl border border-gray-200 p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Incoming Cashier
          </p>

          {verified ? (
            <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2">
              <CheckCircle2 size={15} className="shrink-0 text-green-600" />
              <span className="text-sm font-medium text-green-800">{verified.name}</span>
              <button
                onClick={resetSelection}
                className="ml-auto text-xs text-gray-400 hover:text-gray-600"
              >
                Change
              </button>
            </div>
          ) : selectedUser ? (
            <>
              <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                <span className="text-sm font-medium text-gray-800">{selectedUser.name}</span>
                <button
                  onClick={resetSelection}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  Change
                </button>
              </div>
              <Field label="PIN">
                <input
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
                          className="flex w-full flex-col px-3 py-2 text-left hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg"
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

        <Field label="Declared Cash (₱)">
          <input
            className="input"
            type="number"
            min={0}
            step={0.01}
            value={declaredCash === 0 ? '' : declaredCash}
            onChange={(e) => setDeclaredCash(parseFloat(e.target.value) || 0)}
          />
        </Field>
        <Field label="Notes">
          <input
            className="input"
            placeholder="Optional"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <button onClick={onClose} className="btn-secondary">
          Cancel
        </button>
        <button
          onClick={() =>
            onSubmit({ incomingCashierId: verified!.id, declaredCash, notes: notes || undefined })
          }
          disabled={isLoading || !verified}
          className="rounded-lg bg-yellow-600 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-700 disabled:opacity-50"
        >
          {isLoading ? 'Processing…' : 'Handover'}
        </button>
      </div>
    </Overlay>
  )
}

function ReconciliationModal({
  session,
  data,
  onClose,
}: {
  session: PosSession
  data: SessionReconciliation
  onClose: () => void
}) {
  const variance = data.cashVariance
  const varianceColor =
    variance === 0
      ? 'text-green-700 bg-green-50'
      : variance < 0
        ? 'text-red-700 bg-red-50'
        : 'text-amber-700 bg-amber-50'

  return (
    <Overlay onClose={onClose}>
      <h2 className="mb-1 text-lg font-bold text-gray-900">Session Closed</h2>
      <p className="mb-4 text-sm text-gray-500">
        Terminal: {session.terminal?.name ?? session.terminalId}
      </p>

      <div className="space-y-3">
        <div className="overflow-hidden rounded-xl border border-gray-200">
          {[
            { label: 'Opening Cash', value: data.openingCash },
            { label: 'Expected Closing Cash', value: data.expectedClosingCash },
            { label: 'Declared Closing Cash', value: data.declaredClosingCash },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5 last:border-0"
            >
              <span className="text-sm text-gray-600">{label}</span>
              <span className="text-sm font-medium text-gray-900">{formatCurrency(value)}</span>
            </div>
          ))}
          <div
            className={`flex items-center justify-between px-4 py-2.5 font-semibold ${varianceColor}`}
          >
            <span className="text-sm">Cash Variance</span>
            <span className="text-sm">
              {variance > 0 ? '+' : ''}
              {formatCurrency(variance)}
            </span>
          </div>
        </div>

        {Object.keys(data.paymentBreakdown ?? {}).length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Payment Breakdown
            </p>
            <div className="overflow-hidden rounded-xl border border-gray-200">
              {Object.entries(data.paymentBreakdown).map(([method, amount]) => (
                <div
                  key={method}
                  className="flex items-center justify-between border-b border-gray-100 px-4 py-2 last:border-0"
                >
                  <span className="text-sm capitalize text-gray-600">
                    {method.replace('_', ' ')}
                  </span>
                  <span className="text-sm font-medium text-gray-900">
                    {formatCurrency(amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-end">
        <button onClick={onClose} className="btn-primary">
          Done
        </button>
      </div>
    </Overlay>
  )
}

function Overlay({
  children,
  onClose,
  size = 'md',
}: {
  children: React.ReactNode
  onClose: () => void
  /** 'lg' for modals that lay content out in columns (see CloseSessionModal). */
  size?: 'md' | 'lg'
}) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      {/* items-start + my-auto (rather than items-center) keeps a modal taller
          than the viewport fully reachable — with items-center the top of an
          overflowing panel gets clipped out of reach in every browser. This is
          a safety net for small viewports; no modal should need it by default. */}
      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overscroll-contain p-4">
        <div
          className={`relative my-auto w-full rounded-2xl bg-white p-6 shadow-xl ${
            size === 'lg' ? 'max-w-lg' : 'max-w-md'
          }`}
        >
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-gray-600">{label}</label>
      {children}
    </div>
  )
}
