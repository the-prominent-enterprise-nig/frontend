'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  useSessions,
  useOpenSession,
  useCloseSession,
  useHandoverSession,
  useSessionReconciliation,
  useTerminals,
} from '../_hooks/usePos'
import {
  verifyCashierPin,
  searchUsers,
  getSessionReconciliation,
  getSessionTenderSummary,
  getCurrentSessionUser,
} from '../_actions/pos-actions'
import { PosDateShort } from '../_components/PosDate'
import { usePosBranchContext } from '@/src/stores/pos-branch-context.store'
import { isoDateOf } from '../daily-collection/_utils/business-date'
import { Skeleton } from '@/src/components/ui/Skeleton'
import {
  RefreshCw,
  Monitor,
  Plus,
  X,
  ChevronDown,
  CheckCircle2,
  Loader2,
  ArrowUpRight,
} from 'lucide-react'
import type {
  PosSession,
  OpenSessionInput,
  CloseSessionInput,
  HandoverSessionInput,
  SessionReconciliation,
  SessionTenderSummary,
} from '@/src/schema/pos'
import { useRequirePermission } from '@/src/libs/guards/useRequirePermission'
import { POS_PERMISSIONS } from '@/src/libs/guards/pos-permissions'
import { useMe } from '@/src/hooks/useMe'
import { can } from '@/src/libs/guards/permission'

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
  const router = useRouter()
  const { branchId } = usePosBranchContext()
  const branchFilter = branchId ? { branchId } : undefined
  const { data, isLoading, isFetching, refetch } = useSessions(branchFilter)
  const openMutation = useOpenSession()
  const closeMutation = useCloseSession()
  const handoverMutation = useHandoverSession()

  const [modal, setModal] = useState<ModalState>({ type: 'none' })
  const [error, setError] = useState('')
  // Which row's report is being fetched, so the spinner sits on the button
  // that was actually pressed rather than on every closed row at once.

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

  /**
   * Straight to the branch's Daily Collection Report for the day this shift
   * traded — a whole page, not a dialog. It is the document a supervisor is
   * actually after once a shift is closed, and it is printed, exported and
   * deep-linked, none of which a modal does well.
   *
   * The session's own closing reconciliation stays one button to the left:
   * the posted variance and its GL entry live there, and the collection
   * report does not carry them.
   */
  function handleViewCollectionReport(target: PosSession) {
    const date = isoDateOf(target.openedAt)
    const branch = target.terminal?.branch
    const query = new URLSearchParams({ date })
    if (branch) {
      query.set('branchId', branch.id)
      query.set('branchName', branch.name)
    }
    router.push(`/pos/daily-collection?${query.toString()}`)
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
    // The "Close Session" design's palette, on the app-standard page surface
    // (`bg-zinc-50`, same as the Cash drawer tab) — so the list and the close
    // screen it launches read as one flow while still sitting inside POS,
    // rather than announcing themselves with a background nothing else uses.
    //
    // No tab bar or branch picker on the page: PosTopBar already carries both
    // for every /pos route, and a second copy here would be one more control
    // saying the same thing.
    <div className="min-h-full bg-zinc-50 px-3 py-4 text-[#17171c] sm:px-6 sm:py-6">
      <div className="mx-auto w-full max-w-[1500px]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[21px] font-semibold tracking-[-.02em]">Sessions</h1>
            <p className="mt-0.5 text-[13px] text-[#5b5b6b]">
              Every till shift, and how each one reconciled.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="flex items-center gap-2 rounded-lg border border-[#d3d3db] bg-white px-3.5 py-2 text-[13px] font-medium text-[#17171c] hover:border-[#a3a3b2] hover:bg-[#faf9fb] disabled:opacity-50"
            >
              <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              onClick={() => {
                setError('')
                setModal({ type: 'open' })
              }}
              className="flex items-center gap-2 rounded-lg bg-[#5b21b6] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#4a189b]"
            >
              <Plus size={14} />
              Open session
            </button>
          </div>
        </div>

        {/* Every other error on this page belongs to an open dialog and is
            rendered inside it. This one has no dialog to live in — a report
            that failed to load leaves the list exactly as it was, so without
            it the button would simply do nothing. */}
        {error && modal.type === 'none' && (
          <p className="mt-4 rounded-lg border border-[#f3c9c5] bg-[#fdeceb] px-3.5 py-2.5 text-[12.5px] text-[#b42318]">
            {error}
          </p>
        )}

        <div className="mt-4 overflow-hidden rounded-xl border border-[#e4e4e9] bg-white">
          {isLoading ? (
            <div className="divide-y divide-[#f4f4f6]">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center justify-between gap-4 px-4 py-3.5">
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <Skeleton className="h-3.5 w-44" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-5 w-20 rounded-md" />
                </div>
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-[#a3a3b2]">
              <Monitor size={36} />
              <p className="text-[13px]">No sessions found.</p>
            </div>
          ) : (
            <>
              <div
                className={`hidden gap-3 border-b border-[#eeeef1] bg-[#fbfbfc] px-4 py-2.5 text-[10px] uppercase tracking-[.08em] text-[#5b5b6b] lg:grid ${ROW_GRID}`}
              >
                <span />
                <span>Shift</span>
                <span>Cashier</span>
                <span className="text-right">Opening cash</span>
                <span className="text-right">Txns</span>
                <span>Status</span>
                <span />
              </div>
              {sessions.map((s) => (
                <SessionRow
                  key={s.id}
                  session={s}
                  expanded={expanded === s.id}
                  showBranch={!branchId}
                  onToggle={() => setExpanded((prev) => (prev === s.id ? null : s.id))}
                  onHandover={() => {
                    setError('')
                    setModal({ type: 'handover', session: s })
                  }}
                  onCloseSession={() => {
                    setError('')
                    setModal({ type: 'close', session: s })
                  }}
                  onViewCollectionReport={() => handleViewCollectionReport(s)}
                />
              ))}
            </>
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
function methodLabel(method: string): string {
  if (method === 'qr') return 'QR / Online'
  if (method === 'tpf') return 'TPF'
  return method
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Label for a tender key, which the backend emits either as a bare method
 * ('qr') or as method + the provider the cashier picked at checkout
 * ('qr::Maya', 'card::BDO'). A shift is settled per provider, so the provider
 * is the part that matters here — 'QR / Online — Maya' is checkable against a
 * Maya settlement report, a lumped 'QR / Online' is not. Bare keys still
 * render as before, which keeps sessions closed before this shipped readable.
 */
function tenderLabel(key: string): string {
  const [method, ...rest] = key.split('::')
  const provider = rest.join('::').trim()
  return provider ? `${methodLabel(method)} — ${provider}` : methodLabel(method)
}

/** The desktop row template, shared by the list header and every row so the
 *  two can never drift apart. Below lg each row becomes a card instead.
 *
 *  Every track is either a fixed width or an `fr` share of what those fixed
 *  widths leave over — deliberately nothing content-sized. Each row is its own
 *  grid, so an `auto` track would be measured against that row's own content
 *  and a row carrying two buttons would size its columns differently from the
 *  row above it. The action column is therefore pinned at the width its widest
 *  case needs (Handover + Close session), which keeps every figure in the list
 *  on one vertical line whatever buttons a row happens to have. */
const ROW_GRID =
  'lg:grid-cols-[28px_minmax(170px,1.4fr)_minmax(120px,1.1fr)_118px_58px_112px_206px]'

const STATUS_CHIP: Record<string, { label: string; chip: string; dot: string }> = {
  open: { label: 'Open', chip: 'bg-[#e7f5ef] text-[#0b6644]', dot: 'bg-[#0f7b52]' },
  closed: { label: 'Closed', chip: 'bg-[#f1f1f4] text-[#5b5b6b]', dot: 'bg-[#a3a3b2]' },
  handed_over: { label: 'Handed over', chip: 'bg-[#fdf3e3] text-[#8a4b06]', dot: 'bg-[#c8861a]' },
}

function shiftTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
}

/** "2h 14m" between two moments — how long the till has been, or was, open.
 *  Safe against a clock-skewed closedAt: a negative span renders as nothing
 *  rather than as "-1h". */
function shiftLength(from: string, to?: string | null): string | null {
  const ms = new Date(to ?? Date.now()).getTime() - new Date(from).getTime()
  if (!Number.isFinite(ms) || ms < 0) return null
  const minutes = Math.floor(ms / 60000)
  const hours = Math.floor(minutes / 60)
  return hours ? `${hours}h ${minutes % 60}m` : `${minutes}m`
}

/**
 * Scenario 53 — one shift on the sessions list.
 *
 * Reads as a shift rather than as a database row: the terminal and the hours
 * it covered lead, and the figures a supervisor scans for — opening float,
 * transaction count, status — sit in fixed columns beside it. Everything that
 * explains a variance lives in the expandable panel, one click away, so the
 * list itself stays scannable at a glance across a branch's whole day.
 */
function SessionRow({
  session,
  expanded,
  showBranch,
  onToggle,
  onHandover,
  onCloseSession,
  onViewCollectionReport,
}: {
  session: PosSession
  expanded: boolean
  /** Only when the shell's branch switcher is on "All branches" — with a
   *  branch selected the label would repeat it on every single row. */
  showBranch: boolean
  onToggle: () => void
  onHandover: () => void
  onCloseSession: () => void
  onViewCollectionReport: () => void
}) {
  const isOpen = session.status === 'open'
  const status = STATUS_CHIP[session.status] ?? STATUS_CHIP.closed
  const length = shiftLength(session.openedAt, session.closedAt)
  const terminal = session.terminal?.name ?? session.terminalId
  const cashier = session.cashier?.name || session.cashierId
  const branch = session.terminal?.branch?.name

  const subline = [
    session.closedAt ? `closed ${shiftTime(session.closedAt)}` : 'still open',
    length,
    showBranch ? branch : null,
  ]
    .filter(Boolean)
    .join(' · ')

  const chip = (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-0.5 text-[11.5px] font-medium ${status.chip}`}
    >
      <span className={`h-[5px] w-[5px] rounded-full ${status.dot}`} />
      {status.label}
    </span>
  )

  // No tooltip on the caret: the row it sits on is the label, and a bubble
  // firing on every hover down a list of shifts is noise, not help. The
  // aria-label and aria-expanded still carry it for screen readers.
  const caret = (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      aria-label={expanded ? 'Hide session detail' : 'Show session detail'}
      className={`flex h-6 w-6 items-center justify-center rounded-md ${
        expanded ? 'bg-[#f1ebfb] text-[#3f1490]' : 'text-[#8b8b9b] hover:bg-[#f4f4f6]'
      }`}
    >
      <ChevronDown size={14} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
    </button>
  )

  const actions = (size: 'sm' | 'lg') => {
    const base =
      size === 'sm'
        ? 'rounded-[7px] px-3 py-1.5 text-[12.5px] font-medium whitespace-nowrap'
        : 'min-h-[42px] flex-1 rounded-lg px-3 py-2.5 text-[13px] font-medium'
    // A closed shift is still the thing a supervisor opens this list for —
    // the report is where the posted variance and its GL entry live, so it
    // gets a button of its own rather than only existing behind the close
    // flow that a cashier already walked past.
    if (!isOpen)
      return (
        <button
          onClick={onViewCollectionReport}
          className={`${base} flex items-center justify-center gap-1.5 bg-[#5b21b6] text-white hover:bg-[#4a189b]`}
        >
          View report
          <ArrowUpRight size={13} />
        </button>
      )
    return (
      <>
        <button
          onClick={onHandover}
          className={`${base} border border-[#ddd0f7] bg-[#f1ebfb] text-[#3f1490] hover:bg-[#e8dffa]`}
        >
          Handover
        </button>
        <button
          onClick={onCloseSession}
          className={`${base} bg-[#5b21b6] text-white hover:bg-[#4a189b]`}
        >
          Close session
        </button>
      </>
    )
  }

  return (
    <div className={`border-t border-[#f4f4f6] ${expanded ? 'bg-[#fdfcff]' : 'bg-white'}`}>
      {/* Desktop — fixed columns, so a day's shifts line up down the page. */}
      <div className={`hidden items-center gap-3 px-4 py-3 lg:grid ${ROW_GRID}`}>
        {caret}
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-[12.5px] font-medium">
            {terminal} · opened {shiftTime(session.openedAt)}
          </span>
          <span className="truncate text-[10.5px] text-[#5b5b6b]">{subline}</span>
        </div>
        <span className="min-w-0 truncate text-[12.5px] text-[#3d3d4a]">{cashier}</span>
        <span className="text-right text-[12.5px] tabular-nums">
          {formatCurrency(session.openingCash)}
        </span>
        <span className="text-right text-[12.5px] tabular-nums text-[#3d3d4a]">
          {session._count?.transactions ?? 0}
        </span>
        {chip}
        <div className="flex justify-end gap-1.5">{actions('sm')}</div>
      </div>

      {/* Mobile — the same shift as a card; the columns have nowhere to go. */}
      <div className="flex flex-col gap-2.5 p-3 lg:hidden">
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex min-w-0 items-start gap-2">
            {caret}
            <button
              type="button"
              onClick={onToggle}
              // Not a second tab stop: the caret beside it is the labelled
              // control. This is here so the whole block is tappable, which is
              // what a thumb on a phone actually aims at.
              tabIndex={-1}
              className="flex min-w-0 flex-col text-left"
            >
              <span className="truncate text-[12.5px] font-medium">
                {terminal} · opened {shiftTime(session.openedAt)}
              </span>
              <span className="truncate text-[11px] text-[#5b5b6b]">
                {cashier} · {session._count?.transactions ?? 0} txns ·{' '}
                {formatCurrency(session.openingCash)} float
              </span>
              <span className="truncate text-[11px] text-[#5b5b6b]">{subline}</span>
            </button>
          </div>
          {chip}
        </div>
        <div className="flex gap-2">{actions('lg')}</div>
      </div>

      {expanded && (
        <div className="px-3 pb-3.5 lg:px-4 lg:pb-4">
          <SessionDetail session={session} />
        </div>
      )}
    </div>
  )
}

/** One column of the expanded panel. */
function DetailPane({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-[10px] border border-[#e4e4e9] bg-white px-3.5 py-3">
      <span className="text-[9.5px] uppercase tracking-[.08em] text-[#5b5b6b]">{title}</span>
      {children}
    </div>
  )
}

/**
 * Scenario 53 — the expanded detail for one session row.
 *
 * Three panes, matching the close screen's own reading order: what the cash
 * did, what was taken in, what was counted. The cash pane is built line by
 * line rather than as a lone variance figure, because a lone figure cannot
 * distinguish a real shortage from a cash drop nobody told the cashier about.
 *
 * The movement lines come from /reconciliation, fetched only once a row is
 * expanded — the list itself still costs one request. Everything below the
 * cash pane comes from the closing record persisted in Part 1, which is null
 * for any session closed before that shipped and for any still open, hence
 * the explicit "not recorded" states rather than a zero that would read as a
 * real counted figure.
 */
function SessionDetail({ session }: { session: PosSession }) {
  const { data, isLoading } = useSessionReconciliation(session.id, true)
  const recon = data?.success ? (data.data ?? null) : null

  // Sorted by key so a method's providers sit together ('qr::GCash' next to
  // 'qr::Maya') rather than in whatever order the aggregation returned.
  const tenders = Object.entries(session.tenderBreakdown ?? {})
    .filter(([, amount]) => amount !== 0)
    .sort(([a], [b]) => a.localeCompare(b))
  const denominations = Object.entries(session.denominationBreakdown ?? {})
  const isClosed = session.status !== 'open'

  const opening = Number(session.openingCash ?? 0)
  const expected = recon
    ? Number(recon.expectedClosingCash)
    : isClosed
      ? Number(session.expectedClosingCash ?? 0)
      : null
  const counted = isClosed ? Number(session.declaredClosingCash ?? 0) : null
  const variance = counted !== null && expected !== null ? counted - expected : null
  const isOff = variance !== null && Math.abs(variance) >= 0.01

  // Everything that left the drawer mid-shift, as the one line the spec asks
  // for — a supervisor scanning a variance wants "was anything taken out",
  // not a drops-versus-petty-cash split they can get from the cash drawer log.
  const paidOut = recon
    ? Number(recon.totalCashDrops ?? 0) + Number(recon.totalPettyCashOut ?? 0)
    : null
  // Derived rather than fetched: cash sales alone would need the tender
  // summary endpoint too, and expected also folds in counter collections and
  // petty cash returned. Taking all three together as "cash taken in" keeps
  // the column arithmetic exact — opening + in − out is the expected figure
  // below it, with nothing unexplained in between.
  const cashIn =
    recon && expected !== null && paidOut !== null ? expected - opening + paidOut : null

  const cashRows: {
    key: string
    label: string
    note: string
    value: string
    strong?: boolean
    tone?: string
    muted?: boolean
  }[] = [
    {
      key: 'opening',
      label: 'Opening float',
      note: `handed over at ${shiftTime(session.openedAt)}`,
      value: peso(opening),
    },
  ]

  if (cashIn !== null) {
    cashRows.push({
      key: 'in',
      label: 'Cash taken in',
      note: 'sales, collections and petty cash returned',
      value: peso(cashIn),
    })
  }
  if (paidOut !== null) {
    cashRows.push({
      key: 'out',
      label: 'Drops & payouts',
      note: paidOut ? 'moved out of the drawer' : 'none this shift',
      value: paidOut ? `−${peso(paidOut)}` : '—',
      muted: !paidOut,
    })
  }
  if (expected !== null) {
    cashRows.push({
      key: 'expected',
      label: 'Expected',
      note: 'what the count should come to',
      value: peso(expected),
      strong: true,
    })
  }
  cashRows.push({
    key: 'counted',
    label: 'Counted',
    note: isClosed ? 'declared at close' : 'not counted yet',
    value: counted === null ? '—' : peso(counted),
    muted: counted === null,
  })
  cashRows.push({
    key: 'variance',
    label: isOff ? (variance! > 0 ? 'Over' : 'Short') : 'Over / short',
    note: isClosed ? 'counted less expected' : 'available once closed',
    value:
      variance === null
        ? '—'
        : isOff
          ? `${variance > 0 ? '+' : '−'}${peso(Math.abs(variance))}`
          : peso(0),
    strong: true,
    tone:
      variance === null
        ? 'text-[#5b5b6b]'
        : isOff
          ? variance > 0
            ? 'text-[#1f4b99]'
            : 'text-[#b42318]'
          : 'text-[#0b6644]',
  })

  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid gap-2.5 lg:grid-cols-3">
        <DetailPane title="Cash reconciliation">
          {isLoading && !isClosed ? (
            <div className="space-y-2 py-1">
              <Skeleton className="h-3.5 w-40" />
              <Skeleton className="h-3.5 w-32" />
            </div>
          ) : (
            cashRows.map((row) => (
              <div
                key={row.key}
                className={`flex items-start justify-between gap-3 ${
                  row.strong ? 'mt-0.5 border-t border-[#f1f1f4] pt-1.5' : 'py-0.5'
                }`}
              >
                <div className="flex min-w-0 flex-col">
                  <span className={`text-[12px] ${row.strong ? 'font-semibold' : ''}`}>
                    {row.label}
                  </span>
                  <span className="text-[10px] text-[#5b5b6b]">{row.note}</span>
                </div>
                <span
                  className={`shrink-0 tabular-nums ${
                    row.key === 'variance' ? 'text-[14px]' : 'text-[12.5px]'
                  } ${row.strong ? 'font-semibold' : 'font-medium'} ${
                    row.tone ?? (row.muted ? 'text-[#5b5b6b]' : '')
                  }`}
                >
                  {row.value}
                </span>
              </div>
            ))
          )}
        </DetailPane>

        <DetailPane title="Tenders taken">
          {tenders.length > 0 ? (
            tenders.map(([method, amount], i) => (
              <div
                key={method}
                className={`grid grid-cols-[minmax(0,1fr)_92px] items-baseline gap-2.5 py-1 ${
                  i ? 'border-t border-[#f4f4f6]' : ''
                }`}
              >
                <span className="min-w-0 text-[12px] leading-snug text-[#3d3d4a]">
                  {tenderLabel(method)}
                </span>
                <span className="text-right text-[12px] tabular-nums">{peso(Number(amount))}</span>
              </div>
            ))
          ) : (
            <p className="text-[12px] text-[#5b5b6b]">
              {isClosed ? 'No payments taken this session.' : 'Recorded at close.'}
            </p>
          )}
        </DetailPane>

        <DetailPane title="Denomination count">
          {denominations.length > 0 ? (
            denominations
              // 'coins' carries an amount rather than a count, so it sorts last
              // instead of into the numeric run.
              .sort(([a], [b]) => (a === 'coins' ? 1 : b === 'coins' ? -1 : Number(b) - Number(a)))
              .map(([denomination, value], i) => (
                <div
                  key={denomination}
                  className={`grid grid-cols-[minmax(0,1fr)_48px_84px] items-baseline gap-2 py-1 ${
                    i ? 'border-t border-[#f4f4f6]' : ''
                  }`}
                >
                  <span className="text-[12px] tabular-nums text-[#3d3d4a]">
                    {denomination === 'coins' ? 'Coins' : `₱${denomination}`}
                  </span>
                  <span className="text-right text-[11px] tabular-nums text-[#5b5b6b]">
                    {denomination === 'coins' ? '' : `× ${value}`}
                  </span>
                  <span className="text-right text-[12px] tabular-nums">
                    {peso(denomination === 'coins' ? value : Number(denomination) * value)}
                  </span>
                </div>
              ))
          ) : (
            <p className="text-[12px] leading-relaxed text-[#8a4b06]">
              {isClosed
                ? 'No count recorded for this session.'
                : 'The drawer is counted when the session closes.'}
            </p>
          )}
        </DetailPane>
      </div>

      {(isOff || session.closingNotes) && (
        <div
          className={`flex flex-col gap-0.5 rounded-[10px] px-3.5 py-2.5 ${
            isOff ? 'border border-[#f3c9c5] bg-[#fffbfb]' : 'border border-[#e4e4e9] bg-[#fbfbfc]'
          }`}
        >
          <span
            className={`text-[12.5px] font-semibold ${isOff ? 'text-[#b42318]' : 'text-[#3d3d4a]'}`}
          >
            {isOff
              ? variance! > 0
                ? `Over by ₱${peso(variance!)}`
                : `Short by ₱${peso(-variance!)}`
              : 'Shift note'}
          </span>
          <span className="text-[11.5px] leading-snug text-[#3d3d4a]">
            {session.closingNotes || 'No reason recorded against this difference.'}
          </span>
        </div>
      )}
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

// The close screen takes the "Close Session" design's #5b21b6 palette but
// stays on the app-wide Poppins (`font-sans`), so it reads as part of this app
// rather than as a transplanted screen. Figures carry `tabular-nums` instead
// of a monospace face — that is what actually keeps a column of pesos aligned.

/**
 * The causes a branch actually sees behind a drawer variance. A fixed list,
 * not free text: the checker reviews these across every branch, and forty
 * spellings of "gave wrong change" is a list nobody can count.
 */
const VARIANCE_REASONS = [
  'Wrong change given',
  'Unrecorded payout',
  'Miscount at open',
  'Customer refund not posted',
  'Other',
] as const

/**
 * Scenario 53 — the close screen, rebuilt to the "Close Session" design.
 *
 * Two deliberate departures from the old dialog:
 *
 * 1. It is a full-content surface (`absolute inset-0`, the app shell's `main`
 *    as the positioning frame — same shell as the procurement screens), not a
 *    centred overlay. Counting a drawer means holding the expected figure and
 *    the running count in view at once; a dialog that scrolls pushes one of
 *    them off screen exactly when the cashier needs both.
 *
 * 2. Expected cash is shown as the line-by-line build-up rather than a single
 *    total: float + cash sales + counter collections + petty cash in − cash
 *    drops − petty cash out. A cashier who cannot see WHY the drawer should
 *    hold ₱4,003.79 has no way to tell a real shortage from a cash drop
 *    nobody told them about. Every line comes from the backend's own
 *    computeExpectedCash() via /reconciliation, so the screen can never
 *    disagree with the variance close() actually posts.
 */
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
  // Why the drawer is off. Required before a variance can be submitted: an
  // unexplained variance is a number the branch checker can only escalate,
  // whereas "wrong change given" is one they can close out.
  const [reason, setReason] = useState('')
  const [reasonNote, setReasonNote] = useState('')
  const [reasonTouched, setReasonTouched] = useState(false)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})

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

  // Scenario 53 Part 3 — what the shift took in, and what the drawer is
  // therefore expected to hold. Both load when the screen opens so the
  // cashier can see them while counting; both are read-only. The
  // reconciliation endpoint is happy to run against an open session — its
  // declared/variance fields are meaningless until close, so only the
  // expected-side figures are read here.
  const [tenderSummary, setTenderSummary] = useState<SessionTenderSummary | null>(null)
  const [reconciliation, setReconciliation] = useState<SessionReconciliation | null>(null)
  const [figuresLoading, setFiguresLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    Promise.all([getSessionTenderSummary(session.id), getSessionReconciliation(session.id)]).then(
      ([tenderRes, reconRes]) => {
        if (cancelled) return
        if (tenderRes.success && tenderRes.data) setTenderSummary(tenderRes.data)
        if (reconRes.success && reconRes.data) setReconciliation(reconRes.data)
        setFiguresLoading(false)
      }
    )
    return () => {
      cancelled = true
    }
  }, [session.id])

  const { data: me } = useMe()
  const selfCanApprove = !!me && can(me, POS_PERMISSIONS.TRANSACTIONS_OVERRIDE)

  const coinsAmount = Math.max(0, parseFloat(coins) || 0)
  const noteTotal = DENOMINATIONS.reduce((sum, d) => sum + d * (counts[d] ?? 0), 0)
  const total = noteTotal + coinsAmount
  const pieceCount = DENOMINATIONS.reduce((sum, d) => sum + (counts[d] ?? 0), 0)
  const hasCount = pieceCount > 0 || coinsAmount > 0

  // Display only — the backend recomputes both sides on close and is the
  // authority on the posted variance. Expected comes from its own helper, so
  // the two agree by construction rather than by luck.
  const expected = Number(reconciliation?.expectedClosingCash ?? 0)
  const variance = total - expected
  const isOff = hasCount && Math.abs(variance) >= 0.01
  const reasonMissing = isOff && !reason

  // The time on the float line, so "handed over at 8:02 AM" points at a
  // moment the cashier remembers rather than the vague "at open". Safe to
  // format inline: this screen only ever mounts on a click, so it is never
  // server-rendered and cannot mismatch on hydration.
  const openedAtTime = new Date(session.openedAt).toLocaleTimeString('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
  })

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
    if (!hasCount || reasonMissing) {
      setReasonTouched(true)
      return
    }
    // CloseSessionInput has no variance-reason field, so the reason rides in
    // `notes` — which is what the branch checker reads on the closed session.
    // Prefixed so it stays identifiable if a reason field is added later.
    const varianceNote = isOff
      ? `Variance reason: ${reason}${reasonNote.trim() ? ` — ${reasonNote.trim()}` : ''}`
      : ''
    const composedNotes = [varianceNote, notes.trim()].filter(Boolean).join(' · ')
    onSubmit({
      declaredClosingCash: total,
      notes: composedNotes || undefined,
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

  // The drawer, built line by line. A cashier who can see the float and the
  // drops that make up the expected figure can spot the cause of a variance
  // without asking anyone. Zero lines are kept rather than hidden: "cash
  // drops — none this shift" is itself the answer to "was any cash pulled?".
  //
  // Developer-confirmed 2026-09-19: four movement lines only. The backend's
  // expected figure also folds in counter collections and petty cash returned
  // (see computeExpectedCash), so on a shift that had either, these four will
  // not visibly add up to the total below — the total stays correct, it is
  // the explanation that is partial.
  const expectedRows: {
    key: string
    label: string
    note: string
    amount: number
    strong?: boolean
  }[] = [
    {
      key: 'opening',
      label: 'Opening float',
      note: `handed over at ${openedAtTime}`,
      amount: Number(session.openingCash ?? 0),
    },
    {
      key: 'sales',
      label: 'Cash sales',
      note: 'cash tendered at this terminal',
      amount: Number(tenderSummary?.totalCash ?? 0),
    },
    {
      key: 'drops',
      label: 'Cash drops',
      note: Number(reconciliation?.totalCashDrops ?? 0)
        ? 'moved to the safe mid-shift'
        : 'none this shift',
      amount: -Number(reconciliation?.totalCashDrops ?? 0),
    },
    {
      key: 'pettyOut',
      label: 'Petty cash paid out',
      note: Number(reconciliation?.totalPettyCashOut ?? 0)
        ? 'taken from the drawer'
        : 'none this shift',
      amount: -Number(reconciliation?.totalPettyCashOut ?? 0),
    },
    {
      key: 'expected',
      label: 'Expected in drawer',
      note: 'what the count should come to',
      amount: expected,
      strong: true,
    },
  ]

  // Non-cash grouped by method, with each provider underneath: a shift is
  // settled per provider, so 'QR / Online — Maya' is checkable against a Maya
  // settlement report where a lumped 'QR / Online' is not. Collapsed by
  // default — this panel is context, not the task.
  const nonCashGroups = Object.entries(tenderSummary?.nonCash ?? {})
    .filter(([, amount]) => Number(amount) !== 0)
    .reduce<{ method: string; label: string; total: number; providers: [string, number][] }[]>(
      (groups, [key, amount]) => {
        const [method, ...rest] = key.split('::')
        const provider = rest.join('::').trim()
        const existing = groups.find((g) => g.method === method)
        const group = existing ?? {
          method,
          label: methodLabel(method),
          total: 0,
          providers: [] as [string, number][],
        }
        if (!existing) groups.push(group)
        group.total += Number(amount)
        group.providers.push([provider || methodLabel(method), Number(amount)])
        return groups
      },
      []
    )
    .sort((a, b) => a.label.localeCompare(b.label))

  const tone = !hasCount
    ? { text: 'text-[#5b5b6b]', bg: 'bg-white', border: 'border-[#e4e4e9]' }
    : !isOff
      ? { text: 'text-[#0b6644]', bg: 'bg-[#f4fbf7]', border: 'border-[#dcefe5]' }
      : variance > 0
        ? { text: 'text-[#1f4b99]', bg: 'bg-[#f7f9fd]', border: 'border-[#d7e3f5]' }
        : { text: 'text-[#b42318]', bg: 'bg-[#fffbfb]', border: 'border-[#f3c9c5]' }

  const verdictTitle = !hasCount
    ? 'Count the drawer to reconcile'
    : !isOff
      ? 'Drawer balances'
      : variance > 0
        ? `Over by ₱${peso(variance)}`
        : `Short by ₱${peso(-variance)}`

  const verdictBody = !hasCount
    ? `The drawer should hold ₱${peso(expected)} — the float plus what the shift took in, less what was paid out.`
    : !isOff
      ? `Counted cash matches the ₱${peso(expected)} expected.`
      : variance > 0
        ? 'There is more cash than the shift accounts for. Check for a sale rung on the wrong tender, or float added mid-shift without a drawer event.'
        : `Cash is missing against the ₱${peso(expected)} expected. Recount first, then check for a payout that was never recorded.`

  const blocked = isLoading || !hasCount || reasonMissing || (needsOverride && !verified)

  const inputChrome =
    'h-9 w-full rounded-[7px] border border-[#d3d3db] bg-white px-2.5 text-[13px] text-[#17171c] outline-none focus:border-[#5b21b6] focus:shadow-[0_0_0_3px_#f0e9fc]'

  return (
    // absolute, not fixed: the working surface fills the content column so the
    // nav sidebar and top bar stay usable while a drawer is being counted.
    <div className="absolute inset-0 z-50 flex flex-col bg-[#f2f2f3] text-[#17171c]">
      {/* Head */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#e4e4e9] bg-white px-5 py-4">
        <div className="flex min-w-0 flex-col gap-1">
          <button
            type="button"
            onClick={onClose}
            className="self-start text-[12.5px] text-[#5b21b6] hover:text-[#3f1490]"
          >
            ← Back to sessions
          </button>
          <h2 className="text-[20px] font-semibold tracking-[-.02em]">Close session</h2>
          <p className="text-[12.5px] text-[#5b5b6b]">
            {[
              session.terminal?.branch?.name,
              session.terminal?.name ?? session.terminalId,
              session.cashier?.name,
            ]
              .filter(Boolean)
              .join(' · ')}
            {' · opened '}
            <PosDateShort iso={session.openedAt} />
            {typeof session._count?.transactions === 'number' &&
              ` · ${session._count.transactions} transaction${
                session._count.transactions === 1 ? '' : 's'
              }`}
          </p>
        </div>
      </div>

      {error && (
        <div className="border-b border-[#f3c9c5] bg-[#fdeceb] px-5 py-2.5 text-[12.5px] text-[#b42318]">
          {needsOverride
            ? 'Declared cash does not match the expected amount — a manager must approve before this session can close.'
            : error}
        </div>
      )}

      {/* Body — two columns so the expected figure and the running count stay
          on screen together. Stacks below lg, where they cannot. */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto grid w-full max-w-[1500px] items-start gap-3.5 px-4 py-4 lg:grid-cols-[minmax(0,.82fr)_minmax(0,1.18fr)] lg:px-5">
          {/* ── Left: what should be in the drawer ─────────────────────── */}
          <div className="flex min-w-0 flex-col gap-3">
            <div className="overflow-hidden rounded-[11px] border border-[#e4e4e9] bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eeeef1] px-4 py-3">
                <span className="text-[13.5px] font-semibold">What should be in the drawer</span>
                <span className="text-[11px] text-[#5b5b6b]">System figures — not editable</span>
              </div>
              {figuresLoading ? (
                <div className="space-y-2 px-4 py-3">
                  <Skeleton className="h-4 w-52" />
                  <Skeleton className="h-4 w-44" />
                  <Skeleton className="h-4 w-40" />
                </div>
              ) : reconciliation ? (
                expectedRows.map((row) => (
                  <div
                    key={row.key}
                    className={`flex items-start justify-between gap-4 border-t border-[#f4f4f6] px-4 ${
                      row.strong ? 'border-[#e4e4e9] bg-[#fbfbfc] py-3' : 'py-2.5'
                    }`}
                  >
                    <div className="flex min-w-0 flex-col">
                      <span
                        className={`${row.strong ? 'text-[13px] font-semibold' : 'text-[12.5px]'}`}
                      >
                        {row.label}
                      </span>
                      <span className="text-[10.5px] text-[#5b5b6b]">{row.note}</span>
                    </div>
                    <span
                      className={`shrink-0 tabular-nums ${
                        row.strong
                          ? 'text-[17px] font-semibold tracking-[-.01em]'
                          : `text-[12.5px] font-medium ${
                              row.amount === 0
                                ? 'text-[#5b5b6b]'
                                : row.amount < 0
                                  ? 'text-[#8a4b06]'
                                  : ''
                            }`
                      }`}
                    >
                      {row.strong
                        ? `₱${peso(row.amount)}`
                        : row.amount === 0
                          ? '—'
                          : row.amount < 0
                            ? `−${peso(-row.amount)}`
                            : peso(row.amount)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="px-4 py-3 text-[12.5px] text-[#5b5b6b]">
                  Unable to load what the drawer should hold. Close without it and the variance is
                  still computed by the backend — but count carefully, this screen cannot check it
                  for you.
                </p>
              )}
            </div>

            {/* Non-cash — deliberately outside the comparison above: none of
                it is in the drawer, and folding it in is how a cashier ends
                up hunting for ₱28,690 of GCash in a cash till. */}
            <div className="flex flex-col gap-2 rounded-[11px] border border-[#e4e4e9] bg-white px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-[9.5px] uppercase leading-[1.5] tracking-[.08em] text-[#5b5b6b]">
                  Also taken this shift
                </span>
                <span className="text-[12.5px] tabular-nums text-[#3d3d4a]">
                  {figuresLoading ? '—' : `₱${peso(Number(tenderSummary?.totalNonCash ?? 0))}`}
                </span>
              </div>
              {figuresLoading ? (
                <Skeleton className="h-4 w-40" />
              ) : nonCashGroups.length > 0 ? (
                <div className="flex flex-col">
                  {nonCashGroups.map((group, i) => {
                    const isOpen = !!openGroups[group.method]
                    return (
                      <div key={group.method} className={i ? 'border-t border-[#f4f4f6]' : ''}>
                        <button
                          type="button"
                          onClick={() => setOpenGroups((p) => ({ ...p, [group.method]: !isOpen }))}
                          className="grid w-full grid-cols-[10px_minmax(0,1fr)_auto_96px] items-baseline gap-2.5 py-2 text-left"
                        >
                          <ChevronDown
                            size={10}
                            className={`text-[#7c4fd1] transition-transform ${
                              isOpen ? '' : '-rotate-90'
                            }`}
                          />
                          <span className="min-w-0 text-[12.5px] leading-[1.4]">{group.label}</span>
                          <span className="whitespace-nowrap text-[11px] text-[#5b5b6b]">
                            {group.providers.length > 1
                              ? `${group.providers.length} providers`
                              : ''}
                          </span>
                          <span className="text-right text-[12.5px] font-medium tabular-nums">
                            {peso(group.total)}
                          </span>
                        </button>
                        {isOpen && (
                          <div className="flex flex-col pb-1.5">
                            {group.providers.map(([provider, amount]) => (
                              <div
                                key={provider}
                                className="grid grid-cols-[minmax(0,1fr)_96px] items-baseline gap-2.5 py-1 pl-5"
                              >
                                <span className="min-w-0 text-[11.5px] leading-[1.4] text-[#5b5b6b]">
                                  {provider}
                                </span>
                                <span className="text-right text-[11.5px] tabular-nums text-[#3d3d4a]">
                                  {peso(amount)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-[11.5px] text-[#5b5b6b]">
                  No non-cash payments taken this shift.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="shift-notes" className="text-[12px] font-medium text-[#3d3d4a]">
                Shift notes <span className="font-normal text-[#5b5b6b]">optional</span>
              </label>
              <textarea
                id="shift-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anything the next shift or the checker should know…"
                className="min-h-[84px] w-full resize-y rounded-lg border border-[#d3d3db] bg-white px-3 py-2.5 text-[13px] leading-[1.5] text-[#17171c] outline-none focus:border-[#5b21b6] focus:shadow-[0_0_0_3px_#f0e9fc]"
              />
            </div>
          </div>

          {/* ── Right: the count and the verdict ───────────────────────── */}
          <div className="flex min-w-0 flex-col gap-3">
            <div className="overflow-hidden rounded-[11px] border border-[#e4e4e9] bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eeeef1] px-4 py-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[13.5px] font-semibold">Count the drawer</span>
                  <span className="text-[11px] text-[#5b5b6b]">
                    Pieces per denomination. Tab moves down the list.
                  </span>
                </div>
                {hasCount && (
                  <button
                    type="button"
                    onClick={() => {
                      setCounts(Object.fromEntries(DENOMINATIONS.map((d) => [d, 0])))
                      setCoins('')
                      setReason('')
                      setReasonNote('')
                      setReasonTouched(false)
                    }}
                    className="rounded-md px-2.5 py-1.5 text-[11.5px] text-[#5b21b6] hover:bg-[#f1ebfb]"
                  >
                    Clear count
                  </button>
                )}
              </div>

              {/* Two columns, deliberately: nine denominations plus a coins
                  line stacked vertically runs past the bottom of a laptop
                  viewport. Paired up the whole count fits on screen, so the
                  cashier never scrolls away from the running total. */}
              <div className="grid grid-cols-2">
                {DENOMINATIONS.map((d, i) => (
                  <div
                    key={d}
                    className={`grid grid-cols-[62px_minmax(0,1fr)_96px] items-center gap-2.5 px-4 py-2.5 ${
                      i > 1 ? 'border-t border-[#f4f4f6]' : ''
                    } ${i % 2 === 0 ? 'border-r border-[#f4f4f6]' : ''}`}
                  >
                    <span className="text-[12.5px] font-medium text-[#3d3d4a]">₱{d}</span>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      aria-label={`${d} peso count`}
                      value={counts[d] === 0 ? '' : counts[d]}
                      placeholder="0"
                      onChange={(e) =>
                        setCounts((p) => ({ ...p, [d]: parseInt(e.target.value) || 0 }))
                      }
                      className={`${inputChrome} text-right tabular-nums`}
                    />
                    <span
                      className={`text-right text-[12.5px] tabular-nums ${
                        counts[d] ? '' : 'text-[#5b5b6b]'
                      }`}
                    >
                      {peso(d * (counts[d] ?? 0))}
                    </span>
                  </div>
                ))}
                {/* Coins takes the tenth cell, squaring off the 2x5 grid. A
                    peso amount rather than a count — matches the single lump
                    COINS line on the client's Daily Collection Report form. */}
                <div className="grid grid-cols-[62px_minmax(0,1fr)_96px] items-center gap-2.5 border-t border-[#f4f4f6] px-4 py-2.5">
                  <span className="text-[12px] font-medium text-[#3d3d4a]">Coins</span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    inputMode="decimal"
                    placeholder="0.00"
                    aria-label="Loose coin total"
                    value={coins}
                    onChange={(e) => setCoins(e.target.value)}
                    className={`${inputChrome} text-right tabular-nums`}
                  />
                  <span
                    className={`text-right text-[12.5px] tabular-nums ${
                      coinsAmount ? '' : 'text-[#5b5b6b]'
                    }`}
                  >
                    {peso(coinsAmount)}
                  </span>
                </div>
              </div>

              <div className="flex items-start justify-between gap-4 border-t border-[#e4e4e9] bg-[#fbfbfc] px-4 py-3">
                <div className="flex min-w-0 flex-col">
                  <span className="text-[12.5px] font-semibold">Counted</span>
                  <span className="text-[10.5px] text-[#5b5b6b]">
                    {pieceCount} {pieceCount === 1 ? 'note' : 'notes'}
                    {coinsAmount ? ` + ₱${peso(coinsAmount)} in coins` : ''}
                  </span>
                </div>
                <span className="text-[17px] font-semibold tabular-nums tracking-[-.01em]">
                  ₱{peso(total)}
                </span>
              </div>
            </div>

            {/* Verdict — the whole point of the screen. Stated in words
                first, because "Short by ₱250" is actionable where a bare
                signed number next to an unlabelled total is not. */}
            <div
              className={`flex flex-col gap-3 rounded-[11px] border p-4 ${tone.bg} ${tone.border}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className={`text-[13.5px] font-semibold ${tone.text}`}>{verdictTitle}</span>
                  <span className="text-[12px] leading-[1.5] text-[#3d3d4a]">{verdictBody}</span>
                </div>
                <div className="flex shrink-0 flex-col items-end">
                  <span className="text-[9.5px] uppercase tracking-[.08em] text-[#5b5b6b]">
                    {!hasCount
                      ? 'Over / short'
                      : variance > 0
                        ? 'Over'
                        : isOff
                          ? 'Short'
                          : 'Difference'}
                  </span>
                  <span
                    className={`text-[21px] font-semibold tabular-nums tracking-[-.02em] ${tone.text}`}
                  >
                    {!hasCount
                      ? '—'
                      : !isOff
                        ? `₱${peso(0)}`
                        : variance > 0
                          ? `+${peso(variance)}`
                          : `−${peso(-variance)}`}
                  </span>
                </div>
              </div>

              {isOff && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-medium text-[#3d3d4a]">
                    Explain the difference <span className="text-[#b42318]">*</span>
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {VARIANCE_REASONS.map((r) => {
                      const active = reason === r
                      return (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setReason(r)}
                          className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] ${
                            active
                              ? 'border border-[#5b21b6] bg-[#5b21b6] font-semibold text-white'
                              : `border bg-white text-[#3d3d4a] ${
                                  reasonTouched && !reason ? 'border-[#f3c9c5]' : 'border-[#d3d3db]'
                                }`
                          }`}
                        >
                          {r}
                        </button>
                      )
                    })}
                  </div>
                  <input
                    value={reasonNote}
                    onChange={(e) => setReasonNote(e.target.value)}
                    placeholder={
                      reason === 'Other'
                        ? 'Describe what happened'
                        : 'Add detail for the checker (optional)'
                    }
                    className={`${inputChrome} text-left`}
                  />
                </div>
              )}
            </div>

            {needsOverride && (
              <div className="flex flex-col gap-3 rounded-[11px] border border-[#f7dfc0] bg-[#fdf3e7] p-4">
                <p className="text-[9.5px] uppercase tracking-[.08em] text-[#8a4b06]">
                  Manager approval required
                </p>
                {verified ? (
                  <div className="flex items-center gap-2 rounded-lg bg-[#e7f5ef] px-3 py-2">
                    <CheckCircle2 size={15} className="shrink-0 text-[#0b6644]" />
                    <span className="text-[13px] font-medium text-[#0b6644]">
                      Approved by {verified.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setVerified(null)
                        setSelectedUser(null)
                        setSearch('')
                        setPin('')
                      }}
                      className="ml-auto text-[11.5px] text-[#5b5b6b] hover:text-[#17171c]"
                    >
                      Change
                    </button>
                  </div>
                ) : selectedUser ? (
                  <>
                    <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2">
                      <span className="text-[13px] font-medium">{selectedUser.name}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedUser(null)
                          setPin('')
                          setVerifyError('')
                        }}
                        className="text-[11.5px] text-[#5b5b6b] hover:text-[#17171c]"
                      >
                        Change
                      </button>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label
                        htmlFor="manager-pin"
                        className="text-[12px] font-medium text-[#3d3d4a]"
                      >
                        Manager PIN
                      </label>
                      <input
                        id="manager-pin"
                        type="password"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="4–6 digit PIN"
                        value={pin}
                        onChange={(e) => setPin(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                        className={inputChrome}
                      />
                    </div>
                    {verifyError && <p className="text-[11.5px] text-[#b42318]">{verifyError}</p>}
                    <button
                      type="button"
                      onClick={handleVerify}
                      disabled={verifying || !pin.trim()}
                      className="w-full rounded-lg bg-[#8a4b06] px-3 py-2 text-[13px] font-medium text-white hover:bg-[#6f3c05] disabled:opacity-50"
                    >
                      {verifying ? 'Verifying…' : 'Verify PIN'}
                    </button>
                  </>
                ) : (
                  <>
                    <input
                      placeholder="Search manager by name or email…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className={inputChrome}
                    />
                    {searching && <p className="text-[11.5px] text-[#5b5b6b]">Searching…</p>}
                    {usersError && <p className="text-[11.5px] text-[#b42318]">{usersError}</p>}
                    {filtered.length > 0 && (
                      <div className="overflow-hidden rounded-lg border border-[#e4e4e9] bg-white">
                        {filtered.map((u) => (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => setSelectedUser({ id: u.id, name: u.name })}
                            className="block w-full px-3 py-2 text-left text-[13px] hover:bg-[#f6f6f8]"
                          >
                            {u.name} <span className="text-[11.5px] text-[#5b5b6b]">{u.email}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Foot — the state of the close restated next to the button that
          commits it, so the cashier is never clicking "Close" on a figure
          that has scrolled out of view. */}
      <div className="flex flex-wrap items-center justify-between gap-3.5 border-t border-[#e4e4e9] bg-white px-5 py-3 shadow-[0_-8px_24px_-18px_rgba(20,20,30,.35)]">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className={`text-[11.5px] ${reasonMissing ? 'text-[#b42318]' : 'text-[#5b5b6b]'}`}>
            {!hasCount
              ? `Expected ₱${peso(expected)}`
              : reasonMissing
                ? 'Pick a reason for the difference'
                : isOff
                  ? 'Closes with a flagged variance'
                  : 'Counted cash matches'}
          </span>
          <span className="text-[13px] font-semibold">
            {!hasCount ? 'Nothing counted yet' : `₱${peso(total)} counted of ₱${peso(expected)}`}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#d3d3db] bg-white px-4 py-2.5 text-[13px] font-medium text-[#17171c] hover:border-[#a3a3b2]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={blocked}
            className="flex items-center gap-2 whitespace-nowrap rounded-lg bg-[#5b21b6] px-4 py-2.5 text-[13.5px] font-semibold text-white hover:bg-[#4a189b] disabled:opacity-60"
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {isLoading ? 'Closing…' : isOff ? 'Close with variance' : 'Close session'}
          </button>
        </div>
      </div>
    </div>
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

        {/* Scenario 53 — "Create daily collection report upon closing". The
            report is a branch+day document, so the close hands off to it
            rather than generating a per-session copy. */}
        <a
          href="/pos/daily-collection"
          className="block rounded-xl border border-prominent-purple-200 bg-prominent-purple-50 px-4 py-2.5 text-sm font-medium text-prominent-purple-900 hover:bg-prominent-purple-100"
        >
          View today&apos;s Daily Collection Report →
        </a>

        {Number(data.totalCollectionsCash ?? 0) > 0 && (
          <div className="rounded-xl border border-gray-200 px-4 py-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Installment collections (cash)</span>
              <span className="text-sm font-medium text-gray-900">
                {formatCurrency(Number(data.totalCollectionsCash))}
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-400">
              Counter collections taken this shift — included in expected cash, because the money is
              in the drawer.
            </p>
          </div>
        )}

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-gray-600">{label}</label>
      {children}
    </div>
  )
}
