'use client'

import { useState } from 'react'
import { useCashDrawerEvents, useCreateCashDrawerEvent, useSessions } from '../_hooks/usePos'
import { Wallet, RefreshCw, Plus, X, ChevronDown } from 'lucide-react'
import type { CashDrawerEvent, CreateCashDrawerEventInput } from '@/src/schema/pos'
import { PosDateTime, PosDateShort } from '../_components/PosDate'
import { usePosBranchContext } from '@/src/stores/pos-branch-context.store'
import { Skeleton } from '@/src/components/ui/Skeleton'

const eventTypeLabel: Record<string, string> = {
  no_sale_open: 'No Sale / Open',
  cash_drop: 'Cash Drop',
  petty_cash_in: 'Petty Cash In',
  petty_cash_out: 'Petty Cash Out',
}

const eventTypeColor: Record<string, string> = {
  no_sale_open: 'bg-gray-100 text-gray-600',
  cash_drop: 'bg-blue-100 text-blue-700',
  petty_cash_in: 'bg-green-100 text-green-700',
  petty_cash_out: 'bg-orange-100 text-orange-700',
}

const statusColor: Record<string, string> = {
  open: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-600',
  handed_over: 'bg-yellow-100 text-yellow-700',
}

function formatCurrency(n?: number | null) {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n)
}

export default function CashDrawerPage() {
  const [activeSessionId, setActiveSessionId] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [error, setError] = useState('')

  const { branchId } = usePosBranchContext()
  const {
    data: sessionsData,
    isLoading: sessionsLoading,
    isFetching: sessionsFetching,
  } = useSessions(branchId ? { branchId } : undefined)
  const { data, isLoading, isFetching, refetch } = useCashDrawerEvents(activeSessionId)
  const createMutation = useCreateCashDrawerEvent()

  const sessions = sessionsData?.data ?? []
  const events: CashDrawerEvent[] = data?.data ?? []

  const selectedSession = sessions.find((s) => s.id === activeSessionId)

  async function handleCreate(form: CreateCashDrawerEventInput) {
    setError('')
    const res = await createMutation.mutateAsync(form)
    if (!res.success) {
      setError(res.error ?? 'Failed')
      return
    }
    setShowCreate(false)
  }

  return (
    <div className="min-h-full bg-zinc-50 px-3 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto max-w-5xl space-y-4 sm:space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Cash Drawer</h1>
            <p className="mt-1 text-sm text-gray-500">
              View and record cash drawer events for a session.
            </p>
          </div>
          {activeSessionId && (
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
                  setShowCreate(true)
                }}
                className="flex items-center gap-2 rounded-lg bg-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-purple-800"
              >
                <Plus size={14} />
                Log Event
              </button>
            </div>
          )}
        </div>

        {/* Session selector */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <p className="text-sm font-semibold text-gray-700">Select Session</p>
            {sessionsFetching && !sessionsLoading && (
              <RefreshCw size={12} className="animate-spin text-gray-400" />
            )}
          </div>
          {sessionsLoading ? (
            <Skeleton className="h-9 w-full" />
          ) : (
            <div className="relative">
              <select
                className="select"
                value={activeSessionId}
                onChange={(e) => setActiveSessionId(e.target.value)}
              >
                <option value="">Select a session…</option>
                {sessions.map((s) => {
                  const cashierName = s.cashier?.name || 'Unknown cashier'
                  const terminalName = s.terminal?.name ?? 'Unknown terminal'
                  const date = new Date(s.openedAt).toLocaleString('en-PH', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                  return (
                    <option key={s.id} value={s.id} suppressHydrationWarning>
                      {terminalName} — {cashierName} ({s.status.replace('_', ' ')}) · {date}
                    </option>
                  )
                })}
              </select>
              <ChevronDown
                size={14}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
            </div>
          )}

          {selectedSession && (
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-500">
              <span>
                Terminal:{' '}
                <span className="font-medium text-gray-700">
                  {selectedSession.terminal?.name ?? selectedSession.terminalId}
                </span>
              </span>
              <span>
                Cashier:{' '}
                <span className="font-medium text-gray-700">
                  {selectedSession.cashier?.name || selectedSession.cashierId}
                </span>
              </span>
              <span>
                Opened:{' '}
                <span className="font-medium text-gray-700">
                  <PosDateTime iso={selectedSession.openedAt} />
                </span>
              </span>
              <span>
                Status:{' '}
                <span
                  className={`rounded-full px-2 py-0.5 font-medium ${statusColor[selectedSession.status]}`}
                >
                  {selectedSession.status.replace('_', ' ')}
                </span>
              </span>
              <span>
                Opening Cash:{' '}
                <span className="font-medium text-gray-700">
                  {formatCurrency(selectedSession.openingCash)}
                </span>
              </span>
            </div>
          )}
        </div>

        {/* Events table */}
        {activeSessionId ? (
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            {isLoading ? (
              <div>
                <div className="flex items-center gap-4 border-b border-gray-200 bg-gray-50 px-5 py-3">
                  <Skeleton className="h-3 w-14" />
                  <Skeleton className="ml-auto h-3 w-16" />
                  <Skeleton className="h-3 w-12" />
                  <Skeleton className="h-3 w-10" />
                </div>
                <div className="divide-y divide-gray-100">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center gap-4 px-5 py-3">
                      <Skeleton className="h-5 w-24 rounded-full" />
                      <Skeleton className="ml-auto h-4 w-16" />
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                  ))}
                </div>
              </div>
            ) : events.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-gray-400">
                <Wallet size={36} />
                <p className="text-sm">No cash drawer events for this session.</p>
              </div>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                      Event
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase text-gray-500">
                      Amount
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                      Notes
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                      Time
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {events.map((e) => (
                    <tr key={e.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${eventTypeColor[e.eventType]}`}
                        >
                          {eventTypeLabel[e.eventType]}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right font-medium text-gray-800">
                        {formatCurrency(e.amount)}
                      </td>
                      <td className="px-5 py-3 text-gray-600">{e.notes ?? '—'}</td>
                      <td className="px-5 py-3 text-gray-600">
                        <PosDateTime iso={e.occurredAt ?? e.createdAt} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-gray-300 py-16 text-gray-400">
            <Wallet size={40} />
            <p className="text-sm">Select a session above to view its cash drawer events.</p>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateEventModal
          sessionId={activeSessionId}
          error={error}
          isLoading={createMutation.isPending}
          onClose={() => setShowCreate(false)}
          onSubmit={handleCreate}
        />
      )}
    </div>
  )
}

function CreateEventModal({
  sessionId,
  error,
  isLoading,
  onClose,
  onSubmit,
}: {
  sessionId: string
  error: string
  isLoading: boolean
  onClose: () => void
  onSubmit: (f: CreateCashDrawerEventInput) => void
}) {
  const [form, setForm] = useState({
    eventType: 'cash_drop' as CreateCashDrawerEventInput['eventType'],
    amount: 0,
    notes: '',
  })

  const needsAmount = form.eventType !== 'no_sale_open'

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
          <h2 className="mb-4 text-lg font-bold text-gray-900">Log Cash Drawer Event</h2>
          {error && (
            <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">Event Type</label>
              <div className="relative">
                <select
                  className="select"
                  value={form.eventType}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, eventType: e.target.value as typeof form.eventType }))
                  }
                >
                  {Object.entries(eventTypeLabel).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
              </div>
            </div>
            {needsAmount && (
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600">Amount (₱)</label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.amount === 0 ? '' : form.amount}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, amount: parseFloat(e.target.value) || 0 }))
                  }
                />
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">Notes</label>
              <input
                className="input"
                placeholder="Optional"
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              />
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <button onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button
              onClick={() =>
                onSubmit({
                  sessionId,
                  ...form,
                  amount: needsAmount ? form.amount : undefined,
                  notes: form.notes || undefined,
                })
              }
              disabled={isLoading}
              className="btn-primary"
            >
              {isLoading ? 'Logging…' : 'Log Event'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
