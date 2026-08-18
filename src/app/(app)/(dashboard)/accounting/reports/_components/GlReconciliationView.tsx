'use client'

import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react'
import {
  GlReconciliation,
  fmtMoney,
  fmtDate,
  type ArSubledgerReconciliation,
  type UnearnedInterestReconciliation,
  type EwalletClearingTrend,
} from '@/src/libs/data/AccountingV2Data'

// Scenario 29 ACC-07 — three report-only GL reconciliation checks. Self-
// contained: fetches its own three endpoints on mount rather than sharing
// ReportsHub's single asOf/data state, since these are independent checks
// with different controls (asOf for the first two, a day-window for the
// third).

function MatchBadge({ matches }: { matches: boolean }) {
  return matches ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
      <CheckCircle2 className="h-3.5 w-3.5" />
      Reconciled
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
      <AlertTriangle className="h-3.5 w-3.5" />
      Mismatch
    </span>
  )
}

function TrendBadge({ trend }: { trend: EwalletClearingTrend['trend'] }) {
  const styles = {
    improving: 'bg-emerald-50 text-emerald-700',
    flat: 'bg-gray-100 text-gray-600',
    worsening: 'bg-amber-50 text-amber-700',
  }[trend]
  const label = { improving: 'Trending down', flat: 'Flat', worsening: 'Trending up' }[trend]
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${styles}`}>
      {label}
    </span>
  )
}

export default function GlReconciliationView() {
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10))
  const [days, setDays] = useState(30)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [ar, setAr] = useState<ArSubledgerReconciliation | null>(null)
  const [unearned, setUnearned] = useState<UnearnedInterestReconciliation | null>(null)
  const [ewallet, setEwallet] = useState<EwalletClearingTrend | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [arRes, unearnedRes, ewalletRes] = await Promise.all([
      GlReconciliation.arSubledger(asOf),
      GlReconciliation.unearnedInterest(asOf),
      GlReconciliation.ewalletClearing(days),
    ])
    if (!arRes.success || !unearnedRes.success || !ewalletRes.success) {
      setError(
        arRes.message ||
          arRes.error ||
          unearnedRes.message ||
          unearnedRes.error ||
          ewalletRes.message ||
          ewalletRes.error ||
          'Failed to load reconciliation checks'
      )
    }
    setAr(arRes.data ?? null)
    setUnearned(unearnedRes.data ?? null)
    setEwallet(ewalletRes.data ?? null)
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <label htmlFor="gl-recon-asof" className="block text-xs text-gray-600 mb-1">
            As of (AR / interest checks)
          </label>
          <input
            id="gl-recon-asof"
            type="date"
            value={asOf}
            onChange={(e) => setAsOf(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg"
          />
        </div>
        <div>
          <label htmlFor="gl-recon-days" className="block text-xs text-gray-600 mb-1">
            E-wallet trend window (days)
          </label>
          <input
            id="gl-recon-days"
            type="number"
            min={1}
            value={days}
            onChange={(e) => setDays(Number(e.target.value) || 30)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg w-28"
          />
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-purple-700 text-white rounded-lg hover:bg-purple-800 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Checking…' : 'Run Checks'}
        </button>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <section className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-gray-800">AR Subledger vs. AR Receivable (GL)</h3>
            {ar && <MatchBadge matches={ar.total.matches} />}
          </div>
          {ar && (
            <>
              <p className="text-xs text-gray-500 mb-3">
                As of {fmtDate(ar.asOfDate)} — every open (SENT/PARTIAL/OVERDUE) invoice&apos;s
                remaining balance, compared to the AR Receivable control account&apos;s posted
                balance.
              </p>
              <div className="grid grid-cols-3 gap-4 text-sm mb-3">
                <div>
                  <div className="text-gray-500">Subledger total</div>
                  <div className="font-semibold">{fmtMoney(ar.total.subledger)}</div>
                </div>
                <div>
                  <div className="text-gray-500">GL balance</div>
                  <div className="font-semibold">{fmtMoney(ar.total.gl)}</div>
                </div>
                <div>
                  <div className="text-gray-500">Difference</div>
                  <div
                    className={`font-semibold ${Math.abs(ar.total.diff) > 0.01 ? 'text-red-600' : ''}`}
                  >
                    {fmtMoney(ar.total.diff)}
                  </div>
                </div>
              </div>
              {ar.glBranchTaggingCoverage !== null && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
                  Only {ar.glBranchTaggingCoverage}% of the GL side&apos;s posted amount carries a
                  branch tag today — per-branch rows below reflect what&apos;s traceable, not full
                  coverage, since most AR-posting journal entries aren&apos;t branch-tagged yet.
                </p>
              )}
              {ar.byBranch.length > 0 && (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                    <tr>
                      <th className="px-3 py-2 text-left">Branch</th>
                      <th className="px-3 py-2 text-right">Subledger</th>
                      <th className="px-3 py-2 text-right">GL</th>
                      <th className="px-3 py-2 text-right">Diff</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {ar.byBranch.map((b) => (
                      <tr key={b.branchId ?? 'unassigned'}>
                        <td className="px-3 py-2">{b.branchName ?? 'Unassigned'}</td>
                        <td className="px-3 py-2 text-right">{fmtMoney(b.subledger)}</td>
                        <td className="px-3 py-2 text-right">{fmtMoney(b.gl)}</td>
                        <td
                          className={`px-3 py-2 text-right ${Math.abs(b.diff) > 0.01 ? 'text-red-600 font-medium' : ''}`}
                        >
                          {fmtMoney(b.diff)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </section>

        <section className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-gray-800">
              Remaining Installment Markup vs. Unearned Interest Income (GL)
            </h3>
            {unearned && <MatchBadge matches={unearned.matches} />}
          </div>
          {unearned && (
            <>
              <p className="text-xs text-gray-500 mb-3">
                As of {fmtDate(unearned.asOfDate)} — across {unearned.scheduleWithMarkupCount}{' '}
                contract
                {unearned.scheduleWithMarkupCount === 1 ? '' : 's'} carrying financing markup.
              </p>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-gray-500">Still deferred (subledger)</div>
                  <div className="font-semibold">{fmtMoney(unearned.subledgerRemaining)}</div>
                </div>
                <div>
                  <div className="text-gray-500">GL balance</div>
                  <div className="font-semibold">{fmtMoney(unearned.glBalance)}</div>
                </div>
                <div>
                  <div className="text-gray-500">Difference</div>
                  <div
                    className={`font-semibold ${Math.abs(unearned.diff) > 0.01 ? 'text-red-600' : ''}`}
                  >
                    {fmtMoney(unearned.diff)}
                  </div>
                </div>
              </div>
            </>
          )}
        </section>

        <section className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-gray-800">E-Wallet Clearing Trend</h3>
            {ewallet && <TrendBadge trend={ewallet.trend} />}
          </div>
          {ewallet && (
            <>
              <div className="grid grid-cols-3 gap-4 text-sm mb-3">
                <div>
                  <div className="text-gray-500">Balance {ewallet.periodDays} days ago</div>
                  <div className="font-semibold">{fmtMoney(ewallet.balanceAtPeriodStart)}</div>
                </div>
                <div>
                  <div className="text-gray-500">Current balance</div>
                  <div className="font-semibold">{fmtMoney(ewallet.currentBalance)}</div>
                </div>
                <div>
                  <div className="text-gray-500">Change</div>
                  <div className={`font-semibold ${ewallet.delta > 0 ? 'text-amber-600' : ''}`}>
                    {fmtMoney(ewallet.delta)}
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-400 italic">{ewallet.note}</p>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
