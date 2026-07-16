'use client'

import { useState, useEffect, useRef } from 'react'
import {
  useSessions,
  useOpenSession,
  useCloseSession,
  useHandoverSession,
  useTerminals,
} from '../_hooks/usePos'
import { verifyCashierPin, searchUsers, getSessionReconciliation } from '../_actions/pos-actions'
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

const statusColor: Record<string, string> = {
  open: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-600',
  handed_over: 'bg-yellow-100 text-yellow-700',
}

function formatCurrency(n: number) {
  const safe = n == null || isNaN(n) ? 0 : n
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(safe)
}

type ModalState =
  | { type: 'none' }
  | { type: 'open' }
  | { type: 'close'; session: PosSession }
  | { type: 'handover'; session: PosSession }
  | { type: 'reconciliation'; session: PosSession; data: SessionReconciliation }

export default function SessionsPage() {
  const { branchId } = usePosBranchContext()
  const branchFilter = branchId ? { branchId } : undefined
  const { data, isLoading, isFetching, refetch } = useSessions(branchFilter)
  const openMutation = useOpenSession()
  const closeMutation = useCloseSession()
  const handoverMutation = useHandoverSession()

  const [modal, setModal] = useState<ModalState>({ type: 'none' })
  const [error, setError] = useState('')

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
        // Backend may omit cash summary fields — compute fallbacks from what we know
        const openingCash = rec.data.openingCash ?? prev.session.openingCash ?? 0
        const declaredClosingCash = rec.data.declaredClosingCash ?? form.declaredClosingCash ?? 0
        const cashCollected = rec.data.paymentBreakdown?.cash ?? 0
        const expectedClosingCash = rec.data.expectedClosingCash ?? openingCash + cashCollected
        const cashVariance = rec.data.cashVariance ?? declaredClosingCash - expectedClosingCash
        return {
          type: 'reconciliation',
          session: prev.session,
          data: {
            ...rec.data,
            openingCash,
            declaredClosingCash,
            expectedClosingCash,
            cashVariance,
          },
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

        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
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
                  <tr key={s.id} className="hover:bg-gray-50">
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
                    <td className="px-5 py-3 text-right">
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

  const [form, setForm] = useState({ terminalId: '', openingCash: 0, notes: '' })

  const [filtered, setFiltered] = useState<{ id: string; name: string; email: string }[]>([])
  const [usersError, setUsersError] = useState('')
  const [searching, setSearching] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState<{ id: string; name: string } | null>(null)
  const [pin, setPin] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [verifyError, setVerifyError] = useState('')
  const [verifiedCashier, setVerifiedCashier] = useState<{ id: string; name: string } | null>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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
    setVerifiedCashier({ id: res.data.id, name: res.data.name })
  }

  function resetCashier() {
    setVerifiedCashier(null)
    setSelectedUser(null)
    setSearch('')
    setPin('')
    setVerifyError('')
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
          ) : selectedUser ? (
            <>
              <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                <span className="text-sm font-medium text-gray-800">{selectedUser.name}</span>
                <button
                  onClick={resetCashier}
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
            value={form.openingCash === 0 ? '' : form.openingCash}
            onChange={(e) =>
              setForm((p) => ({ ...p, openingCash: parseFloat(e.target.value) || 0 }))
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
          onClick={() => onSubmit({ ...form, cashierId: verifiedCashier!.id })}
          disabled={!canSubmit}
          className="btn-primary disabled:opacity-50"
        >
          {isLoading ? 'Opening…' : 'Open Session'}
        </button>
      </div>
    </Overlay>
  )
}

const DENOMINATIONS = [1000, 500, 200, 100, 50, 20]

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
  const [notes, setNotes] = useState('')

  const total = DENOMINATIONS.reduce((sum, d) => sum + d * (counts[d] ?? 0), 0)

  const denominationBreakdown = Object.fromEntries(
    DENOMINATIONS.filter((d) => (counts[d] ?? 0) > 0).map((d) => [String(d), counts[d]])
  )

  return (
    <Overlay onClose={onClose}>
      <h2 className="mb-1 text-lg font-bold text-gray-900">Close Session</h2>
      <p className="mb-4 text-sm text-gray-500">
        Terminal: {session.terminal?.name ?? session.terminalId}
      </p>
      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      <div className="space-y-4">
        <div>
          <label className="mb-2 block text-xs font-semibold text-gray-600">
            Cash Denomination Count
          </label>
          <div className="overflow-hidden rounded-lg border border-gray-200">
            {DENOMINATIONS.map((d, i) => (
              <div
                key={d}
                className={`flex items-center gap-3 px-4 py-2 ${i < DENOMINATIONS.length - 1 ? 'border-b border-gray-100' : ''}`}
              >
                <span className="w-16 text-sm font-medium text-gray-700">₱{d}</span>
                <input
                  className="input w-20 text-center"
                  type="number"
                  min={0}
                  step={1}
                  value={counts[d] === 0 ? '' : counts[d]}
                  onChange={(e) => setCounts((p) => ({ ...p, [d]: parseInt(e.target.value) || 0 }))}
                />
                <span className="text-xs text-gray-400">×</span>
                <span className="w-20 text-right text-sm text-gray-600">
                  ₱{(d * (counts[d] ?? 0)).toLocaleString()}
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between bg-gray-50 px-4 py-2">
              <span className="text-sm font-semibold text-gray-700">Total</span>
              <span className="text-sm font-bold text-gray-900">₱{total.toLocaleString()}</span>
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
      </div>
      <div className="mt-6 flex justify-end gap-3">
        <button onClick={onClose} className="btn-secondary">
          Cancel
        </button>
        <button
          onClick={() =>
            onSubmit({
              declaredClosingCash: total,
              notes: notes || undefined,
              denominationBreakdown:
                Object.keys(denominationBreakdown).length > 0 ? denominationBreakdown : undefined,
            })
          }
          disabled={isLoading}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {isLoading ? 'Closing…' : `Close Session (₱${total.toLocaleString()})`}
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
      const res = await searchUsers(search.trim(), branchId ?? undefined)
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

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
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
