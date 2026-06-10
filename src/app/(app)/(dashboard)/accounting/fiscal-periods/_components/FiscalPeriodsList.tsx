'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Plus,
  RefreshCw,
  Lock,
  LockOpen,
  Unlock,
  Trash2,
  X,
  ListChecks,
  History,
  Check,
} from 'lucide-react'
import {
  FiscalPeriods,
  CHECKLIST_LABELS,
  type FiscalPeriod,
  type FiscalPeriodStatus,
  type ChecklistKey,
  type ChecklistStatus,
  type PeriodReopenLog,
  fmtDate,
} from '@/src/libs/data/AccountingV2Data'

const STATUS_STYLES: Record<FiscalPeriodStatus, string> = {
  OPEN: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  SOFT_CLOSED: 'bg-amber-50 text-amber-700 border-amber-200',
  HARD_CLOSED: 'bg-red-50 text-red-700 border-red-200',
}
const STATUS_LABELS: Record<FiscalPeriodStatus, string> = {
  OPEN: 'Open',
  SOFT_CLOSED: 'Soft Closed',
  HARD_CLOSED: 'Hard Closed',
}

function getStatus(p: FiscalPeriod): FiscalPeriodStatus {
  return (p.status as FiscalPeriodStatus) ?? (p.isLocked ? 'HARD_CLOSED' : 'OPEN')
}

export default function FiscalPeriodsList() {
  const [items, setItems] = useState<FiscalPeriod[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [checklistFor, setChecklistFor] = useState<FiscalPeriod | null>(null)
  const [reopenFor, setReopenFor] = useState<FiscalPeriod | null>(null)
  const [logsFor, setLogsFor] = useState<FiscalPeriod | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const r = await FiscalPeriods.list()
    setItems(r.data ?? [])
    setLoading(false)
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const softClose = async (id: string) => {
    if (
      !confirm(
        'Soft close this period? New postings will be blocked, but reversal entries are still allowed.'
      )
    )
      return
    const r = await FiscalPeriods.softClose(id)
    if (!r.success) {
      alert(r.message || r.error || 'Failed')
      return
    }
    load()
  }
  const hardClose = async (id: string) => {
    if (
      !confirm(
        'Hard close this period? The period will be locked entirely. Reopening requires the accounting:fiscal:reopen permission and a reason.'
      )
    )
      return
    const r = await FiscalPeriods.hardClose(id)
    if (!r.success) {
      alert(r.message || r.error || 'Failed')
      return
    }
    load()
  }
  const del = async (id: string) => {
    if (!confirm('Delete this period?')) return
    const r = await FiscalPeriods.remove(id)
    if (!r.success) {
      alert(r.message || r.error || 'Failed')
      return
    }
    load()
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold">Fiscal Periods</h2>
          <p className="text-sm text-gray-500">
            Period-close workflow with soft & hard close states.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="flex items-center gap-2 px-3 py-2 text-sm text-purple-700 hover:bg-purple-50 rounded-lg"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-purple-700 text-white rounded-lg hover:bg-purple-800"
          >
            <Plus className="w-4 h-4" /> New Period
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Period</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Closed At</th>
              <th className="px-3 py-2 text-left">Closed By</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-gray-400">
                  Loading...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-gray-400">
                  No fiscal periods.
                </td>
              </tr>
            ) : (
              items.map((p) => {
                const status = getStatus(p)
                const closedAt = p.lockedAt ?? p.softClosedAt
                const closedBy = p.lockedBy ?? p.softClosedBy
                return (
                  <tr key={p.id}>
                    <td className="px-3 py-2 font-medium">{p.name}</td>
                    <td className="px-3 py-2 text-xs text-gray-600">
                      {fmtDate(p.startDate)} → {fmtDate(p.endDate)}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLES[status]}`}
                      >
                        {STATUS_LABELS[status]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs">{closedAt ? fmtDate(closedAt) : '—'}</td>
                    <td className="px-3 py-2 text-xs text-gray-600">{closedBy ?? '—'}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => setChecklistFor(p)}
                          className="p-1.5 text-purple-600 hover:bg-purple-50 rounded"
                          title="Close checklist"
                        >
                          <ListChecks className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setLogsFor(p)}
                          className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"
                          title="Reopen history"
                        >
                          <History className="w-4 h-4" />
                        </button>
                        {status === 'OPEN' && (
                          <>
                            <button
                              onClick={() => softClose(p.id)}
                              className="p-1.5 text-amber-600 hover:bg-amber-50 rounded"
                              title="Soft close"
                            >
                              <Lock className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => hardClose(p.id)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                              title="Hard close"
                            >
                              <Lock className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => del(p.id)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {status === 'SOFT_CLOSED' && (
                          <>
                            <button
                              onClick={() => hardClose(p.id)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                              title="Escalate to hard close"
                            >
                              <Lock className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setReopenFor(p)}
                              className="p-1.5 text-purple-600 hover:bg-purple-50 rounded"
                              title="Reopen"
                            >
                              <LockOpen className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {status === 'HARD_CLOSED' && (
                          <button
                            onClick={() => setReopenFor(p)}
                            className="p-1.5 text-purple-600 hover:bg-purple-50 rounded"
                            title="Reopen (requires reason)"
                          >
                            <Unlock className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {creating && (
        <PeriodForm
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false)
            load()
          }}
        />
      )}
      {checklistFor && (
        <ChecklistDialog period={checklistFor} onClose={() => setChecklistFor(null)} />
      )}
      {reopenFor && (
        <ReopenDialog
          period={reopenFor}
          onClose={() => setReopenFor(null)}
          onSaved={() => {
            setReopenFor(null)
            load()
          }}
        />
      )}
      {logsFor && <ReopenLogsDialog period={logsFor} onClose={() => setLogsFor(null)} />}
    </div>
  )
}

function PeriodForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: '', startDate: '', endDate: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    await FiscalPeriods.create(form)
    setSaving(false)
    onSaved()
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="text-lg font-semibold">New Period</h3>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <label className="block">
            <span className="block text-xs font-medium text-gray-600 mb-1">Name *</span>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="March 2026"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs font-medium text-gray-600 mb-1">Start *</span>
              <input
                required
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-gray-600 mb-1">End *</span>
              <input
                required
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </label>
          </div>
          <label className="block">
            <span className="block text-xs font-medium text-gray-600 mb-1">Notes</span>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </label>
          <div className="flex justify-end gap-2 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold bg-purple-700 text-white rounded-lg disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ChecklistDialog({ period, onClose }: { period: FiscalPeriod; onClose: () => void }) {
  const [status, setStatus] = useState<ChecklistStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const isHardClosed = getStatus(period) === 'HARD_CLOSED'

  const load = useCallback(async () => {
    setLoading(true)
    const r = await FiscalPeriods.getChecklist(period.id)
    setStatus(r.data ?? null)
    setLoading(false)
  }, [period.id])
  useEffect(() => {
    load()
  }, [load])

  const toggle = async (key: ChecklistKey, done: boolean) => {
    await FiscalPeriods.setChecklistItem(period.id, key, done)
    load()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h3 className="text-lg font-semibold">Close Checklist</h3>
            <p className="text-xs text-gray-500">{period.name}</p>
          </div>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-5 space-y-2">
          {loading ? (
            <div className="text-gray-400 text-sm">Loading…</div>
          ) : !status ? (
            <div className="text-gray-400 text-sm">Failed to load.</div>
          ) : (
            <>
              <div className="text-sm text-gray-600 mb-3">
                Progress:{' '}
                <span className="font-semibold">
                  {status.completed}/{status.total}
                </span>
                {status.complete && (
                  <span className="ml-2 text-emerald-700">✓ All items complete</span>
                )}
              </div>
              {(Object.keys(CHECKLIST_LABELS) as ChecklistKey[]).map((key) => {
                const item = status.checklist[key]
                const done = item?.done ?? false
                return (
                  <label
                    key={key}
                    className={`flex items-center gap-3 p-2.5 rounded-lg border ${done ? 'border-emerald-200 bg-emerald-50/60' : 'border-gray-200'} ${isHardClosed ? 'opacity-60' : 'cursor-pointer hover:bg-gray-50'}`}
                  >
                    <input
                      type="checkbox"
                      checked={done}
                      disabled={isHardClosed}
                      onChange={(e) => toggle(key, e.target.checked)}
                      className="w-4 h-4 accent-emerald-600"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900">
                        {CHECKLIST_LABELS[key]}
                      </div>
                      {done && item?.completedAt && (
                        <div className="text-[10px] text-gray-500">
                          Completed {new Date(item.completedAt).toLocaleString('en-PH')} by{' '}
                          {item.completedBy ?? '—'}
                        </div>
                      )}
                    </div>
                    {done && <Check className="w-4 h-4 text-emerald-600" />}
                  </label>
                )
              })}
              {isHardClosed && (
                <p className="text-xs text-gray-500 italic mt-2">
                  Period is hard-closed. Checklist is read-only.
                </p>
              )}
            </>
          )}
        </div>
        <div className="flex justify-end px-5 py-3 border-t bg-gray-50">
          <button onClick={onClose} className="px-4 py-2 text-sm hover:bg-white rounded-lg">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function ReopenDialog({
  period,
  onClose,
  onSaved,
}: {
  period: FiscalPeriod
  onClose: () => void
  onSaved: () => void
}) {
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reason.trim()) {
      setError('Reason is required')
      return
    }
    setSaving(true)
    setError(null)
    const r = await FiscalPeriods.reopen(period.id, reason.trim())
    setSaving(false)
    if (!r.success) {
      setError(r.message || r.error || 'Failed')
      return
    }
    onSaved()
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h3 className="text-lg font-semibold">Reopen Period</h3>
            <p className="text-xs text-gray-500">
              {period.name} — {STATUS_LABELS[getStatus(period)]}
            </p>
          </div>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
            Reopening a closed period is logged for audit. Requires the{' '}
            <code className="font-mono">accounting:fiscal:reopen</code> permission.
          </div>
          <label className="block">
            <span className="block text-xs font-medium text-gray-600 mb-1">
              Reason for reopening *
            </span>
            <textarea
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              placeholder="e.g. Late adjusting entry from auditor for ..."
            />
          </label>
          {error && (
            <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold bg-purple-700 text-white rounded-lg disabled:opacity-50"
            >
              {saving ? 'Reopening…' : 'Reopen Period'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ReopenLogsDialog({ period, onClose }: { period: FiscalPeriod; onClose: () => void }) {
  const [logs, setLogs] = useState<PeriodReopenLog[] | null>(null)
  useEffect(() => {
    FiscalPeriods.getReopenLogs(period.id).then((r) => setLogs(r.data ?? []))
  }, [period.id])
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h3 className="text-lg font-semibold">Reopen History</h3>
            <p className="text-xs text-gray-500">{period.name}</p>
          </div>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-5 max-h-96 overflow-y-auto">
          {logs === null ? (
            <div className="text-gray-400 text-sm">Loading…</div>
          ) : logs.length === 0 ? (
            <div className="text-gray-400 text-sm italic">This period has never been reopened.</div>
          ) : (
            <div className="space-y-2">
              {logs.map((l) => (
                <div key={l.id} className="p-3 border border-gray-200 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-900">{l.reopenedBy}</span>
                    <span className="text-xs text-gray-500">
                      {new Date(l.reopenedAt).toLocaleString('en-PH')}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mb-2">
                    Previously: {STATUS_LABELS[l.previousStatus]}
                  </div>
                  <div className="text-sm text-gray-700">{l.reason}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex justify-end px-5 py-3 border-t bg-gray-50">
          <button onClick={onClose} className="px-4 py-2 text-sm hover:bg-white rounded-lg">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
