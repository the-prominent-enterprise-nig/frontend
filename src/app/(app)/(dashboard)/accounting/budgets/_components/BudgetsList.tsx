'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, RefreshCw, BarChart3, Trash2, X, AlertTriangle, AlertOctagon } from 'lucide-react'
import {
  Budgets,
  type Budget,
  type BudgetGrain,
  type VarianceRow,
  fmtMoney,
} from '@/src/libs/data/AccountingV2Data'
import { getAccounts, type Account } from '@/src/libs/data/AccountingData'

const CURRENT_YEAR = new Date().getFullYear()

export default function BudgetsList() {
  const [tab, setTab] = useState<'list' | 'variance'>('list')
  const [year, setYear] = useState(CURRENT_YEAR)
  const [items, setItems] = useState<Budget[]>([])
  const [variance, setVariance] = useState<VarianceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    if (tab === 'list') {
      const r = await Budgets.list({ fiscalYear: year })
      setItems(r.data ?? [])
    } else {
      const r = await Budgets.variance(year)
      setVariance(r.data ?? [])
    }
    setLoading(false)
  }, [tab, year])
  useEffect(() => {
    load()
  }, [load])

  const del = async (id: string) => {
    if (!confirm('Delete budget?')) return
    await Budgets.remove(id)
    load()
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold">Budgets</h2>
          <p className="text-sm text-gray-500">
            Plan budgets per account/period and compare to actuals.
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <label className="text-sm">
            FY{' '}
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="ml-1 w-24 px-2 py-1 text-sm border border-gray-200 rounded"
            />
          </label>
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
            <Plus className="w-4 h-4" /> New Budget
          </button>
        </div>
      </div>

      <div className="flex gap-1 border-b border-gray-200 mb-4">
        <button
          onClick={() => setTab('list')}
          className={`px-3 py-2 text-sm font-medium border-b-2 ${tab === 'list' ? 'border-purple-600 text-purple-700' : 'border-transparent text-gray-600'}`}
        >
          Budgets
        </button>
        <button
          onClick={() => setTab('variance')}
          className={`px-3 py-2 text-sm font-medium border-b-2 ${tab === 'variance' ? 'border-purple-600 text-purple-700' : 'border-transparent text-gray-600'}`}
        >
          <BarChart3 className="w-3 h-3 inline mr-1" /> Variance Report
        </button>
      </div>

      {tab === 'list' ? (
        <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-600">
              <tr>
                <th className="px-3 py-2 text-left">Account</th>
                <th className="px-3 py-2 text-left">Grain</th>
                <th className="px-3 py-2 text-left">Period</th>
                <th className="px-3 py-2 text-right">Budget</th>
                <th className="px-3 py-2 text-left">Warn @</th>
                <th className="px-3 py-2 text-left">Alert @</th>
                <th className="px-3 py-2 text-left">Owner</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-gray-400">
                    Loading...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-gray-400">
                    No budgets for FY {year}.
                  </td>
                </tr>
              ) : (
                items.map((b) => (
                  <tr key={b.id}>
                    <td className="px-3 py-2">
                      {b.account ? (
                        <div>
                          <div className="font-medium">{b.account.name}</div>
                          <div className="text-xs text-gray-500 font-mono">{b.account.number}</div>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs">{b.grain}</td>
                    <td className="px-3 py-2 text-xs">{b.periodIndex ?? 'Year'}</td>
                    <td className="px-3 py-2 text-right font-medium">
                      {fmtMoney(b.budgetedAmount)}
                    </td>
                    <td className="px-3 py-2 text-xs">{b.warnThresholdPercent ?? '—'}%</td>
                    <td className="px-3 py-2 text-xs">{b.alertThresholdPercent ?? '—'}%</td>
                    <td className="px-3 py-2 text-xs text-gray-600">{b.ownerEmail ?? '—'}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => del(b.id)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-600">
              <tr>
                <th className="px-3 py-2 text-left">Account</th>
                <th className="px-3 py-2 text-left">Period</th>
                <th className="px-3 py-2 text-right">Budget</th>
                <th className="px-3 py-2 text-right">Actual</th>
                <th className="px-3 py-2 text-right">Variance</th>
                <th className="px-3 py-2 text-right">Used %</th>
                <th className="px-3 py-2 text-right">YE Forecast</th>
                <th className="px-3 py-2 text-center">Alert</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-gray-400">
                    Loading...
                  </td>
                </tr>
              ) : variance.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-gray-400">
                    No budgets for FY {year}.
                  </td>
                </tr>
              ) : (
                variance.map((r) => (
                  <tr key={r.budgetId}>
                    <td className="px-3 py-2">
                      {r.account ? (
                        <div>
                          <div className="font-medium">{r.account.name}</div>
                          <div className="text-xs text-gray-500 font-mono">{r.account.number}</div>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {r.grain} {r.periodIndex ?? ''}
                    </td>
                    <td className="px-3 py-2 text-right">{fmtMoney(r.budgetedAmount)}</td>
                    <td className="px-3 py-2 text-right">{fmtMoney(r.actual)}</td>
                    <td
                      className={`px-3 py-2 text-right font-medium ${r.variance >= 0 ? 'text-emerald-700' : 'text-red-700'}`}
                    >
                      {fmtMoney(r.variance)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {r.usedPct !== null ? `${r.usedPct.toFixed(1)}%` : '—'}
                    </td>
                    <td className="px-3 py-2 text-right text-xs">
                      {r.forecastFullYear !== null ? fmtMoney(r.forecastFullYear) : '—'}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {r.alertTriggered ? (
                        <AlertOctagon className="w-4 h-4 text-red-600 inline" />
                      ) : r.warnTriggered ? (
                        <AlertTriangle className="w-4 h-4 text-amber-600 inline" />
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {creating && (
        <BudgetForm
          year={year}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false)
            load()
          }}
        />
      )}
    </div>
  )
}

function BudgetForm({
  year,
  onClose,
  onSaved,
}: {
  year: number
  onClose: () => void
  onSaved: () => void
}) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [form, setForm] = useState({
    accountId: '',
    grain: 'MONTHLY' as BudgetGrain,
    fiscalYear: year,
    periodIndex: 1,
    budgetedAmount: '',
    warnThresholdPercent: '80',
    alertThresholdPercent: '100',
    ownerEmail: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getAccounts({ limit: 500 }).then((r) => {
      const d = r.data as any
      setAccounts((d?.items ?? d ?? []) as Account[])
    })
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const payload: any = {
      ...form,
      budgetedAmount: Number(form.budgetedAmount),
      warnThresholdPercent: Number(form.warnThresholdPercent),
      alertThresholdPercent: Number(form.alertThresholdPercent),
      periodIndex: form.grain === 'ANNUAL' ? null : Number(form.periodIndex),
    }
    const r = await Budgets.create(payload)
    setSaving(false)
    if (!r.success) {
      setError(r.message || r.error || 'Failed')
      return
    }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-white">
          <h3 className="text-lg font-semibold">New Budget</h3>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <F label="Account *">
            <select
              required
              value={form.accountId}
              onChange={(e) => setForm({ ...form, accountId: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            >
              <option value="">— Select —</option>
              {accounts.map((a: any) => (
                <option key={a.id} value={a.id}>
                  {a.number ?? a.code} — {a.name}
                </option>
              ))}
            </select>
          </F>
          <div className="grid grid-cols-2 gap-3">
            <F label="Grain *">
              <select
                value={form.grain}
                onChange={(e) => setForm({ ...form, grain: e.target.value as BudgetGrain })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              >
                <option value="MONTHLY">Monthly</option>
                <option value="QUARTERLY">Quarterly</option>
                <option value="ANNUAL">Annual</option>
              </select>
            </F>
            <F label="Fiscal Year *">
              <input
                required
                type="number"
                value={form.fiscalYear}
                onChange={(e) => setForm({ ...form, fiscalYear: Number(e.target.value) })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </F>
          </div>
          {form.grain !== 'ANNUAL' && (
            <F label="Period Index *">
              <input
                required
                type="number"
                min="1"
                max={form.grain === 'MONTHLY' ? 12 : 4}
                value={form.periodIndex}
                onChange={(e) => setForm({ ...form, periodIndex: Number(e.target.value) })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
              <span className="block text-[10px] text-gray-500 mt-1">
                {form.grain === 'MONTHLY' ? '1=Jan, 12=Dec' : '1=Q1, 4=Q4'}
              </span>
            </F>
          )}
          <F label="Budgeted Amount *">
            <input
              required
              type="number"
              step="0.01"
              value={form.budgetedAmount}
              onChange={(e) => setForm({ ...form, budgetedAmount: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </F>
          <div className="grid grid-cols-2 gap-3">
            <F label="Warn at %">
              <input
                type="number"
                min="0"
                max="100"
                value={form.warnThresholdPercent}
                onChange={(e) => setForm({ ...form, warnThresholdPercent: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </F>
            <F label="Alert at %">
              <input
                type="number"
                min="0"
                max="200"
                value={form.alertThresholdPercent}
                onChange={(e) => setForm({ ...form, alertThresholdPercent: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </F>
          </div>
          <F label="Owner Email">
            <input
              type="email"
              value={form.ownerEmail}
              onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })}
              placeholder="Notified when thresholds are hit"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </F>
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
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
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
