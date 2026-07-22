'use client'

import { useEffect, useState } from 'react'
import { Plus, Coins, Check, X as XIcon, Trash2, Sparkles, HelpCircle } from 'lucide-react'
import { collectionIncentivesApi, collectorsApi } from '@/src/libs/api/crm'
import { getBranches } from '../_actions/get-branches'
import {
  createCollectionIncentiveSchema,
  type CreateCollectionIncentiveInput,
} from '@/src/schema/crm/collection-incentive'
import type { CollectionIncentive } from '@/src/schema/crm/types'

const STATUS_COLORS: Record<string, string> = {
  auto_approved: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  pending_approval: 'bg-amber-50 text-amber-700 ring-amber-200',
  approved: 'bg-blue-50 text-blue-700 ring-blue-200',
  rejected: 'bg-red-50 text-red-700 ring-red-200',
}

const CATEGORY_COLORS: Record<string, string> = {
  A: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  B: 'bg-blue-50 text-blue-700 ring-blue-200',
  C: 'bg-amber-50 text-amber-700 ring-amber-200',
  D: 'bg-red-50 text-red-700 ring-red-200',
}

function Badge({ value, colors }: { value: string; colors: Record<string, string> }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
        colors[value] ?? 'bg-gray-100 text-gray-600 ring-gray-200'
      }`}
    >
      {value.replace('_', ' ')}
    </span>
  )
}

function peso(amount: number | string): string {
  return `₱${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
}

export default function CollectionIncentivesList({
  canCreate,
  canApprove,
  canDelete,
}: {
  canCreate: boolean
  canApprove: boolean
  canDelete: boolean
}) {
  const [incentives, setIncentives] = useState<CollectionIncentive[]>([])
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [collectors, setCollectors] = useState<{ id: string; name: string; stubNumber: string }[]>(
    []
  )
  const [collectorFilter, setCollectorFilter] = useState('')
  const [branchFilter, setBranchFilter] = useState('')
  const [periodFilter, setPeriodFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newOpen, setNewOpen] = useState(false)
  const [generateOpen, setGenerateOpen] = useState(false)
  const [rejectTarget, setRejectTarget] = useState<CollectionIncentive | null>(null)

  useEffect(() => {
    getBranches().then((res) => {
      if (res.success && res.data) setBranches(res.data.data)
    })
    collectorsApi.list({ limit: 200 }).then((res) => {
      if (res.success && res.data) setCollectors(res.data.data)
    })
  }, [])

  function reload() {
    setLoading(true)
    collectionIncentivesApi
      .list({
        collectorId: collectorFilter || undefined,
        branchId: branchFilter || undefined,
        period: periodFilter || undefined,
        status: statusFilter || undefined,
        limit: 50,
      })
      .then((res) => {
        if (res.success && res.data) setIncentives(res.data.data)
        else setError(res.error ?? 'Failed to load collection incentives')
        setLoading(false)
      })
  }

  useEffect(() => {
    const t = setTimeout(reload, 200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectorFilter, branchFilter, periodFilter, statusFilter])

  async function handleApprove(id: string) {
    const res = await collectionIncentivesApi.approve(id)
    if (res.success) reload()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this collection incentive?')) return
    const res = await collectionIncentivesApi.remove(id)
    if (res.success) reload()
  }

  const collectorName = (id: string) => {
    const c = collectors.find((x) => x.id === id)
    return c ? `${c.stubNumber} — ${c.name}` : id
  }
  const branchName = (id?: string | null) => branches.find((b) => b.id === id)?.name

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Collection Incentives</h1>
          <p className="mt-1 text-sm text-gray-500">
            Category A/B incentives auto-approve; C/D require management approval.
          </p>
        </div>
        {canCreate && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setGenerateOpen(true)}
              title="Provisional — flat rate defaults to 5% pending client confirmation"
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
            >
              <Sparkles className="h-4 w-4" />
              Generate monthly
              <HelpCircle className="h-3.5 w-3.5 opacity-60" />
            </button>
            <button
              onClick={() => setNewOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-prominent-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-prominent-orange-700"
            >
              <Plus className="h-4 w-4" />
              New incentive
            </button>
          </div>
        )}
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
        <select
          value={collectorFilter}
          onChange={(e) => setCollectorFilter(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
        >
          <option value="">All collectors</option>
          {collectors.map((c) => (
            <option key={c.id} value={c.id}>
              {c.stubNumber} — {c.name}
            </option>
          ))}
        </select>
        <select
          value={branchFilter}
          onChange={(e) => setBranchFilter(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
        >
          <option value="">All branches</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <input
          value={periodFilter}
          onChange={(e) => setPeriodFilter(e.target.value)}
          placeholder="Period (YYYY-MM)"
          className="w-40 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm placeholder:text-gray-400"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="auto_approved">Auto-approved</option>
          <option value="pending_approval">Pending approval</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {loading && (
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-12 text-center text-gray-400">
          Loading…
        </div>
      )}
      {!loading && error && (
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-12 text-center text-red-500">
          {error}
        </div>
      )}
      {!loading && !error && incentives.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-12 text-center text-gray-400">
          No collection incentives match these filters yet.
        </div>
      )}

      {!loading && !error && incentives.length > 0 && (
        <>
          {/* Mobile: cards */}
          <ul className="space-y-3 md:hidden">
            {incentives.map((inc) => (
              <li key={inc.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 font-medium text-gray-900">
                    <Coins className="h-4 w-4 text-prominent-orange-600" />
                    {inc.collector?.stubNumber ?? collectorName(inc.collectorId)}
                  </span>
                  <Badge value={inc.status} colors={STATUS_COLORS} />
                </div>
                <div className="mt-1 flex items-center gap-2 text-[12px] text-gray-500">
                  <Badge value={inc.category} colors={CATEGORY_COLORS} />
                  {inc.isAutoGenerated && <span className="text-gray-400">auto</span>}
                  <span>{inc.period}</span>
                  <span>·</span>
                  <span>{inc.branch?.name ?? branchName(inc.branchId) ?? 'No branch'}</span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[15px] font-semibold tabular-nums text-gray-900">
                    {peso(inc.amount)}
                  </span>
                  <IncentiveActions
                    incentive={inc}
                    canApprove={canApprove}
                    canDelete={canDelete}
                    onApprove={() => handleApprove(inc.id)}
                    onReject={() => setRejectTarget(inc)}
                    onDelete={() => handleDelete(inc.id)}
                  />
                </div>
              </li>
            ))}
          </ul>

          {/* Desktop: table */}
          <div className="hidden overflow-hidden rounded-xl border border-gray-200 bg-white md:block">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Collector</th>
                    <th className="px-4 py-3">Branch</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Period</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-800">
                  {incentives.map((inc) => (
                    <tr key={inc.id} className="transition-colors hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {inc.collector
                          ? `${inc.collector.stubNumber} — ${inc.collector.name}`
                          : collectorName(inc.collectorId)}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-gray-600">
                        {inc.branch?.name ?? branchName(inc.branchId) ?? (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5">
                          <Badge value={inc.category} colors={CATEGORY_COLORS} />
                          {inc.isAutoGenerated && (
                            <span className="text-[11px] text-gray-400">auto</span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-gray-600">{inc.period}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium text-gray-900">
                        {peso(inc.amount)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge value={inc.status} colors={STATUS_COLORS} />
                      </td>
                      <td className="px-4 py-3">
                        <IncentiveActions
                          incentive={inc}
                          canApprove={canApprove}
                          canDelete={canDelete}
                          onApprove={() => handleApprove(inc.id)}
                          onReject={() => setRejectTarget(inc)}
                          onDelete={() => handleDelete(inc.id)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {newOpen && (
        <NewIncentiveModal
          branches={branches}
          collectors={collectors}
          onClose={() => setNewOpen(false)}
          onCreated={() => {
            setNewOpen(false)
            reload()
          }}
        />
      )}

      {rejectTarget && (
        <RejectIncentiveModal
          incentive={rejectTarget}
          onClose={() => setRejectTarget(null)}
          onRejected={() => {
            setRejectTarget(null)
            reload()
          }}
        />
      )}

      {generateOpen && (
        <GenerateMonthlyModal
          onClose={() => setGenerateOpen(false)}
          onGenerated={() => {
            setGenerateOpen(false)
            reload()
          }}
        />
      )}
    </div>
  )
}

function GenerateMonthlyModal({
  onClose,
  onGenerated,
}: {
  onClose: () => void
  onGenerated: () => void
}) {
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7))
  const [ratePercent, setRatePercent] = useState(5)
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [result, setResult] = useState<{
    created: number
    skipped: number
    totalAmount: number
  } | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setServerError(null)
    const res = await collectionIncentivesApi.generateMonthly({ period, ratePercent })
    setSubmitting(false)
    if (res.success && res.data) {
      setResult({
        created: res.data.created.length,
        skipped: res.data.skipped.length,
        totalAmount: res.data.created.reduce((sum, c) => sum + Number(c.amount), 0),
      })
    } else {
      setServerError(res.error ?? 'Failed to generate monthly incentives')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-1 text-lg font-semibold text-gray-900">Generate monthly incentives</h2>
        <p className="mb-4 flex items-start gap-1.5 text-[12px] text-gray-500">
          <HelpCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-60" />
          Provisional — credits each collector a flat % of what they remitted this period. The rate
          isn&apos;t client-confirmed yet; adjust it below per run. Safe to re-run — already
          generated collectors are skipped.
        </p>

        {result ? (
          <div className="space-y-3">
            <div className="rounded-lg bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
              Created {result.created} incentive{result.created === 1 ? '' : 's'} totalling{' '}
              {peso(result.totalAmount)}.
              {result.skipped > 0 && (
                <span className="mt-1 block text-emerald-700">
                  Skipped {result.skipped} collector{result.skipped === 1 ? '' : 's'} already
                  generated for this period.
                </span>
              )}
            </div>
            <div className="flex justify-end">
              <button
                onClick={onGenerated}
                className="rounded-lg bg-prominent-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-prominent-orange-700"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-[13px] font-medium text-gray-700">Period *</label>
              <input
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                placeholder="2026-07"
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-gray-700">
                Rate (% of amount collected)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={ratePercent}
                onChange={(e) => setRatePercent(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              />
            </div>
            {serverError && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{serverError}</p>
            )}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-prominent-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-prominent-orange-700 disabled:opacity-50"
              >
                {submitting ? 'Generating…' : 'Generate'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function IncentiveActions({
  incentive,
  canApprove,
  canDelete,
  onApprove,
  onReject,
  onDelete,
}: {
  incentive: CollectionIncentive
  canApprove: boolean
  canDelete: boolean
  onApprove: () => void
  onReject: () => void
  onDelete: () => void
}) {
  const isPending = incentive.status === 'pending_approval'
  return (
    <div className="flex items-center justify-end gap-1.5">
      {isPending && canApprove && (
        <>
          <button
            onClick={onApprove}
            title="Approve"
            className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            onClick={onReject}
            title="Reject"
            className="rounded-lg p-1.5 text-red-600 hover:bg-red-50"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </>
      )}
      {canDelete && (
        <button
          onClick={onDelete}
          title="Delete"
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

function NewIncentiveModal({
  branches,
  collectors,
  onClose,
  onCreated,
}: {
  branches: { id: string; name: string }[]
  collectors: { id: string; name: string; stubNumber: string }[]
  onClose: () => void
  onCreated: () => void
}) {
  const defaultPeriod = new Date().toISOString().slice(0, 7)
  const [form, setForm] = useState<CreateCollectionIncentiveInput>({
    collectorId: '',
    branchId: '',
    installmentAccountId: '',
    category: 'A',
    period: defaultPeriod,
    amount: 0,
    notes: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const setField = <K extends keyof CreateCollectionIncentiveInput>(
    key: K,
    value: CreateCollectionIncentiveInput[K]
  ) => setForm((f) => ({ ...f, [key]: value }))

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError(null)
    const parsed = createCollectionIncentiveSchema.safeParse(form)
    if (!parsed.success) {
      const errs: Record<string, string> = {}
      parsed.error.issues.forEach((i) => {
        errs[i.path[0] as string] = i.message
      })
      setErrors(errs)
      return
    }
    setErrors({})
    setSubmitting(true)
    const res = await collectionIncentivesApi.create(parsed.data)
    setSubmitting(false)
    if (res.success) {
      onCreated()
    } else {
      setServerError(res.error ?? 'Failed to create collection incentive')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">New collection incentive</h2>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-[13px] font-medium text-gray-700">Collector *</label>
            <select
              value={form.collectorId}
              onChange={(e) => setField('collectorId', e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">Select a collector…</option>
              {collectors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.stubNumber} — {c.name}
                </option>
              ))}
            </select>
            {errors.collectorId && (
              <p className="mt-1 text-[12px] text-red-600">{errors.collectorId}</p>
            )}
          </div>

          <div>
            <label className="block text-[13px] font-medium text-gray-700">Branch</label>
            <select
              value={form.branchId ?? ''}
              onChange={(e) => setField('branchId', e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">Unassigned</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-medium text-gray-700">Category *</label>
              <select
                value={form.category}
                onChange={(e) =>
                  setField('category', e.target.value as CreateCollectionIncentiveInput['category'])
                }
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              >
                <option value="A">A — auto-approve</option>
                <option value="B">B — auto-approve</option>
                <option value="C">C — needs approval</option>
                <option value="D">D — needs approval</option>
              </select>
            </div>
            <div>
              <label className="block text-[13px] font-medium text-gray-700">Period *</label>
              <input
                value={form.period}
                onChange={(e) => setField('period', e.target.value)}
                placeholder="2026-07"
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              />
              {errors.period && <p className="mt-1 text-[12px] text-red-600">{errors.period}</p>}
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-medium text-gray-700">Amount (₱) *</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.amount}
              onChange={(e) => setField('amount', Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            />
            {errors.amount && <p className="mt-1 text-[12px] text-red-600">{errors.amount}</p>}
          </div>

          <div>
            <label className="block text-[13px] font-medium text-gray-700">Notes</label>
            <textarea
              rows={2}
              value={form.notes ?? ''}
              onChange={(e) => setField('notes', e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            />
          </div>

          {serverError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{serverError}</p>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-prominent-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-prominent-orange-700 disabled:opacity-50"
            >
              {submitting ? 'Saving…' : 'Create incentive'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function RejectIncentiveModal({
  incentive,
  onClose,
  onRejected,
}: {
  incentive: CollectionIncentive
  onClose: () => void
  onRejected: () => void
}) {
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setServerError(null)
    const res = await collectionIncentivesApi.reject(incentive.id, { reason })
    setSubmitting(false)
    if (res.success) {
      onRejected()
    } else {
      setServerError(res.error ?? 'Failed to reject incentive')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Reject incentive</h2>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-[13px] font-medium text-gray-700">Reason</label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. duplicate entry"
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            />
          </div>
          {serverError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{serverError}</p>
          )}
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
            >
              {submitting ? 'Rejecting…' : 'Reject'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
