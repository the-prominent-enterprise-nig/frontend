'use client'

import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, TrendingUp, TrendingDown, Sliders } from 'lucide-react'
import { CashForecast, type CashForecastResult, fmtMoney } from '@/src/libs/data/AccountingV2Data'

export default function CashForecastView() {
  const [horizonWeeks, setHorizonWeeks] = useState(13)
  const [openingBalance, setOpeningBalance] = useState('0')
  const [arDelayDays, setArDelayDays] = useState('0')
  const [apAccelerateDays, setApAccelerateDays] = useState('0')
  const [data, setData] = useState<CashForecastResult | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const r = await CashForecast.get({
      weeks: horizonWeeks,
      openingBalance: Number(openingBalance) || 0,
      arDelayDays: Number(arDelayDays) || 0,
      apAccelerateDays: Number(apAccelerateDays) || 0,
    })
    setData(r.data ?? null)
    setLoading(false)
  }, [horizonWeeks, openingBalance, arDelayDays, apAccelerateDays])
  useEffect(() => {
    load()
  }, [])

  const minClosing = data?.weeks.reduce((min, w) => Math.min(min, w.closing), Infinity) ?? 0
  const maxClosing = data?.weeks.reduce((max, w) => Math.max(max, w.closing), -Infinity) ?? 0
  const range = Math.max(1, Math.abs(maxClosing - minClosing))

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold">Cash Forecast</h2>
          <p className="text-sm text-gray-500">
            Rolling weekly view from AR aging, AP due dates, payroll, and recurring entries.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-purple-700 text-white rounded-lg hover:bg-purple-800 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />{' '}
          {loading ? 'Forecasting…' : 'Run Forecast'}
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Sliders className="w-4 h-4 text-purple-700" />
          <span className="text-sm font-semibold">Assumptions (what-if scenarios)</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <F label="Horizon (weeks)">
            <input
              type="number"
              min="1"
              max="52"
              value={horizonWeeks}
              onChange={(e) => setHorizonWeeks(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </F>
          <F label="Opening Balance">
            <input
              type="number"
              step="0.01"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </F>
          <F label="Delay AR (days)">
            <input
              type="number"
              value={arDelayDays}
              onChange={(e) => setArDelayDays(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </F>
          <F label="Accelerate AP (days)">
            <input
              type="number"
              value={apAccelerateDays}
              onChange={(e) => setApAccelerateDays(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </F>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Toggle without changing live data. Click "Run Forecast" to recompute.
        </p>
      </div>

      {!data ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-lg p-12 text-center text-gray-400">
          Run the forecast to see results.
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-600">
              <tr>
                <th className="px-3 py-2 text-left">Week</th>
                <th className="px-3 py-2 text-right">Opening</th>
                <th className="px-3 py-2 text-right">Inflows</th>
                <th className="px-3 py-2 text-right">Outflows</th>
                <th className="px-3 py-2 text-right">Closing</th>
                <th className="px-3 py-2 text-left">Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.weeks.map((w, i) => {
                const barPct = ((w.closing - minClosing) / range) * 100
                return (
                  <tr key={w.label}>
                    <td className="px-3 py-2 font-mono text-xs">
                      W{i + 1} ·{' '}
                      {new Date(w.weekStart).toLocaleDateString('en-PH', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="px-3 py-2 text-right">{fmtMoney(w.opening)}</td>
                    <td className="px-3 py-2 text-right text-emerald-700">
                      {w.totalIn > 0 ? (
                        <div className="flex items-center justify-end gap-1">
                          <TrendingUp className="w-3 h-3" />
                          {fmtMoney(w.totalIn)}
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-red-700">
                      {w.totalOut > 0 ? (
                        <div className="flex items-center justify-end gap-1">
                          <TrendingDown className="w-3 h-3" />
                          {fmtMoney(w.totalOut)}
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-semibold ${w.closing < 0 ? 'text-red-700' : 'text-gray-900'}`}
                    >
                      {fmtMoney(w.closing)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${w.closing >= 0 ? 'bg-emerald-400' : 'bg-red-400'}`}
                          style={{ width: `${Math.max(2, barPct)}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-600 mb-1">{label}</span>
      {children}
    </label>
  )
}
