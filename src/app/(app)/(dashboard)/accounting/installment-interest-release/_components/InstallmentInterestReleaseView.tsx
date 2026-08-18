'use client'

import { useCallback, useEffect, useState } from 'react'
import { Percent, RefreshCw, PlayCircle } from 'lucide-react'
import { hasPermission } from '@/src/hooks/usePermission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import { type SessionUser } from '@/src/libs/guards/permission'
import {
  InstallmentInterestRelease,
  type PendingInterestReleaseResult,
  type InterestReleaseRunResult,
  fmtMoney,
} from '@/src/libs/data/AccountingV2Data'

function shortId(id: string) {
  return id.slice(0, 8).toUpperCase()
}

export default function InstallmentInterestReleaseView({
  session,
}: {
  session: SessionUser | null
}) {
  const [pending, setPending] = useState<PendingInterestReleaseResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastRun, setLastRun] = useState<InterestReleaseRunResult | null>(null)

  const canRun = hasPermission(session, ACCOUNTING_PERMISSIONS.INSTALLMENT_INTEREST_RELEASE)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const r = await InstallmentInterestRelease.getPending()
    if (!r.success) {
      setError(r.message || r.error || 'Failed to load pending releases')
    }
    setPending(r.data ?? null)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleRun = async () => {
    if (
      !confirm(
        "Release every eligible contract's elapsed financing markup? This posts one journal entry per contract and cannot be undone by re-running."
      )
    )
      return
    setRunning(true)
    setError(null)
    const r = await InstallmentInterestRelease.run({})
    setRunning(false)
    if (!r.success) {
      setError(r.message || r.error || 'Failed to run the release batch')
      return
    }
    setLastRun(r.data ?? null)
    await load()
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-prominent-purple-900 flex items-center gap-2">
            <Percent className="w-6 h-6" />
            Installment Interest Release
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Month-end batch: releases each installment contract&apos;s elapsed financing markup from
            Unearned Interest Income into recognized interest income.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          {canRun && (
            <button
              onClick={handleRun}
              disabled={running || loading || !pending?.schedules.length}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              <PlayCircle className="w-4 h-4" />
              {running ? 'Running…' : 'Run Release'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {lastRun && (
        <div className="mb-6 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800">
          <p className="font-medium mb-2">
            Released {lastRun.schedulesReleased} contract
            {lastRun.schedulesReleased === 1 ? '' : 's'}, totaling {fmtMoney(lastRun.totalReleased)}
            .
          </p>
          {lastRun.results.length > 0 && (
            <ul className="space-y-1">
              {lastRun.results.map((r) => (
                <li key={r.installmentScheduleId} className="text-xs text-emerald-700">
                  Contract {shortId(r.installmentScheduleId)} — {r.periodsReleased} period
                  {r.periodsReleased === 1 ? '' : 's'}, {fmtMoney(r.amountReleased)}, JE{' '}
                  {shortId(r.journalEntryId)}
                </li>
              ))}
            </ul>
          )}
          {lastRun.skipped.length > 0 && (
            <p className="text-xs text-amber-700 mt-2">
              {lastRun.skipped.length} contract{lastRun.skipped.length === 1 ? '' : 's'} skipped
              (already released by a concurrent run) — safe to ignore.
            </p>
          )}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-700">
            Pending release
            {pending ? ` — as of ${new Date(pending.asOfDate).toLocaleDateString()}` : ''}
          </h2>
          {pending && (
            <span className="text-sm font-semibold text-prominent-purple-900">
              Total: {fmtMoney(pending.totalPending)}
            </span>
          )}
        </div>
        {loading ? (
          <div className="px-4 py-8 text-center text-sm text-gray-400">Loading…</div>
        ) : !pending?.schedules.length ? (
          <div className="px-4 py-8 text-center text-sm text-gray-400">
            Nothing eligible right now — every contract is either fully released or has no elapsed
            due dates yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2 text-left">Contract</th>
                <th className="px-4 py-2 text-left">Sale #</th>
                <th className="px-4 py-2 text-right">Periods elapsed</th>
                <th className="px-4 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pending.schedules.map((s) => (
                <tr key={s.installmentScheduleId}>
                  <td className="px-4 py-2 font-mono text-xs text-gray-600">
                    {shortId(s.installmentScheduleId)}
                  </td>
                  <td className="px-4 py-2 text-gray-600">{s.transactionNumber ?? '—'}</td>
                  <td className="px-4 py-2 text-right">{s.periodsEligible}</td>
                  <td className="px-4 py-2 text-right font-medium">{fmtMoney(s.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
