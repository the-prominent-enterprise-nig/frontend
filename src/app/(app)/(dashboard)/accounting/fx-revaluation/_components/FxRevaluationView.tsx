'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, RefreshCw, X, Play, FileText } from 'lucide-react'
import {
  FxRevaluation,
  type FxRate,
  type RevaluationRun,
  fmtMoney,
  fmtDate,
} from '@/src/libs/data/AccountingV2Data'
import { getCurrencies, type Currency } from '@/src/libs/data/AccountingData'

export default function FxRevaluationView() {
  const [tab, setTab] = useState<'rates' | 'runs'>('rates')
  const [rates, setRates] = useState<FxRate[]>([])
  const [runs, setRuns] = useState<RevaluationRun[]>([])
  const [loading, setLoading] = useState(true)
  const [addingRate, setAddingRate] = useState(false)
  const [runningPreview, setRunningPreview] = useState(false)
  const [previewing, setPreviewing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    if (tab === 'rates') {
      const r = await FxRevaluation.listRates()
      setRates(r.data ?? [])
    } else {
      const r = await FxRevaluation.listRuns()
      setRuns(r.data ?? [])
    }
    setLoading(false)
  }, [tab])
  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold">FX Revaluation</h2>
          <p className="text-sm text-gray-500">
            Manage effective-dated FX rates and run period-end revaluation of foreign-currency
            balances.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="flex items-center gap-2 px-3 py-2 text-sm text-purple-700 hover:bg-purple-50 rounded-lg"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          {tab === 'rates' && (
            <button
              onClick={() => setAddingRate(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-purple-700 text-white rounded-lg hover:bg-purple-800"
            >
              <Plus className="w-4 h-4" /> Add Rate
            </button>
          )}
          {tab === 'runs' && (
            <button
              onClick={() => setRunningPreview(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-purple-700 text-white rounded-lg hover:bg-purple-800"
            >
              <Play className="w-4 h-4" /> New Revaluation
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-1 border-b border-gray-200 mb-4">
        <button
          onClick={() => setTab('rates')}
          className={`px-3 py-2 text-sm font-medium border-b-2 ${tab === 'rates' ? 'border-purple-600 text-purple-700' : 'border-transparent text-gray-600'}`}
        >
          FX Rates
        </button>
        <button
          onClick={() => setTab('runs')}
          className={`px-3 py-2 text-sm font-medium border-b-2 ${tab === 'runs' ? 'border-purple-600 text-purple-700' : 'border-transparent text-gray-600'}`}
        >
          Revaluation Runs
        </button>
      </div>

      {tab === 'rates' ? (
        <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-600">
              <tr>
                <th className="px-3 py-2 text-left">Currency</th>
                <th className="px-3 py-2 text-left">Effective Date</th>
                <th className="px-3 py-2 text-right">Rate</th>
                <th className="px-3 py-2 text-left">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-gray-400">
                    Loading...
                  </td>
                </tr>
              ) : rates.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-gray-400">
                    No FX rates yet.
                  </td>
                </tr>
              ) : (
                rates.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2 font-medium">{r.currency?.code ?? r.currencyId}</td>
                    <td className="px-3 py-2 text-xs">{fmtDate(r.effectiveDate)}</td>
                    <td className="px-3 py-2 text-right font-mono">{Number(r.rate).toFixed(4)}</td>
                    <td className="px-3 py-2 text-xs text-gray-600">{r.source ?? '—'}</td>
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
                <th className="px-3 py-2 text-left">As of</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-right">Total Gain/Loss</th>
                <th className="px-3 py-2 text-right">Lines</th>
                <th className="px-3 py-2 text-left">JE</th>
                <th className="px-3 py-2 text-left">Reversal JE</th>
                <th className="px-3 py-2 text-left">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-gray-400">
                    Loading...
                  </td>
                </tr>
              ) : runs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-gray-400">
                    No revaluation runs yet.
                  </td>
                </tr>
              ) : (
                runs.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2 text-xs">{fmtDate(r.asOfDate)}</td>
                    <td className="px-3 py-2 text-xs">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {r.status}
                      </span>
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-medium ${r.totalGainLoss >= 0 ? 'text-emerald-700' : 'text-red-700'}`}
                    >
                      {fmtMoney(r.totalGainLoss)}
                    </td>
                    <td className="px-3 py-2 text-right">{r.lines?.length ?? 0}</td>
                    <td className="px-3 py-2 text-xs font-mono">
                      {r.journalEntryId ? r.journalEntryId.slice(0, 8) : '—'}
                    </td>
                    <td className="px-3 py-2 text-xs font-mono">
                      {r.reversalJEId ? r.reversalJEId.slice(0, 8) : '—'}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600 max-w-xs truncate">
                      {r.notes ?? '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {addingRate && (
        <AddRateDialog
          onClose={() => setAddingRate(false)}
          onSaved={() => {
            setAddingRate(false)
            load()
          }}
        />
      )}
      {runningPreview && (
        <RunRevaluationDialog
          onClose={() => setRunningPreview(false)}
          onSaved={() => {
            setRunningPreview(false)
            setPreviewing(false)
            load()
          }}
        />
      )}
      {previewing && null}
    </div>
  )
}

function AddRateDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [form, setForm] = useState({
    currencyId: '',
    rate: '',
    effectiveDate: new Date().toISOString().slice(0, 10),
    source: 'MANUAL',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getCurrencies().then((r) => {
      const d = r.data as any
      setCurrencies((d?.items ?? d ?? []) as Currency[])
    })
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const r = await FxRevaluation.addRate({
      currencyId: form.currencyId,
      rate: Number(form.rate),
      effectiveDate: form.effectiveDate,
      source: form.source || undefined,
    })
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
          <h3 className="text-lg font-semibold">Add FX Rate</h3>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <F label="Currency *">
            <select
              required
              value={form.currencyId}
              onChange={(e) => setForm({ ...form, currencyId: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            >
              <option value="">— Select —</option>
              {currencies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </F>
          <F label="Effective Date *">
            <input
              required
              type="date"
              value={form.effectiveDate}
              onChange={(e) => setForm({ ...form, effectiveDate: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </F>
          <F label="Rate (base per 1 unit) *">
            <input
              required
              type="number"
              step="0.0001"
              min="0"
              value={form.rate}
              onChange={(e) => setForm({ ...form, rate: e.target.value })}
              placeholder="e.g. 56.5000 for USD→PHP"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </F>
          <F label="Source">
            <input
              value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value })}
              placeholder="MANUAL, BSP_REFERENCE..."
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

function RunRevaluationDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [preview, setPreview] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runPreview = async () => {
    setLoading(true)
    setError(null)
    const r = await FxRevaluation.preview(asOfDate)
    setLoading(false)
    if (!r.success) {
      setError(r.message || r.error || 'Failed')
      return
    }
    setPreview(r.data)
  }

  const post = async () => {
    setPosting(true)
    setError(null)
    const r = await FxRevaluation.createRun({ asOfDate, notes: notes || undefined })
    setPosting(false)
    if (!r.success) {
      setError(r.message || r.error || 'Failed')
      return
    }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-white">
          <h3 className="text-lg font-semibold">Run FX Revaluation</h3>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <F label="As of Date *">
              <input
                required
                type="date"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </F>
            <div className="flex items-end">
              <button
                onClick={runPreview}
                disabled={loading}
                className="w-full px-4 py-2 text-sm font-medium border border-purple-300 text-purple-700 hover:bg-purple-50 rounded-lg disabled:opacity-50"
              >
                <FileText className="w-3 h-3 inline mr-1" />{' '}
                {loading ? 'Computing…' : 'Preview Impact'}
              </button>
            </div>
          </div>

          {preview && (
            <div className="border border-purple-200 bg-purple-50/40 rounded-lg p-3">
              <div className="text-sm font-semibold mb-2">
                Preview as of {fmtDate(preview.asOfDate)}
              </div>
              <div className="text-sm mb-2">
                Total unrealised{' '}
                <span
                  className={`font-bold ${preview.totalGainLoss >= 0 ? 'text-emerald-700' : 'text-red-700'}`}
                >
                  {preview.totalGainLoss >= 0 ? 'gain' : 'loss'}:{' '}
                  {fmtMoney(Math.abs(preview.totalGainLoss))}
                </span>
              </div>
              {preview.lines?.length === 0 ? (
                <div className="text-xs text-gray-500 italic">
                  No foreign-currency accounts to revalue.
                </div>
              ) : (
                <div className="bg-white border border-gray-200 rounded overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="px-2 py-1 text-left">Account</th>
                        <th className="px-2 py-1 text-right">Before</th>
                        <th className="px-2 py-1 text-right">Rate</th>
                        <th className="px-2 py-1 text-right">After</th>
                        <th className="px-2 py-1 text-right">Gain/Loss</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {preview.lines?.map((l: any, i: number) => (
                        <tr key={i}>
                          <td className="px-2 py-1 font-mono">{l.accountId.slice(0, 8)}</td>
                          <td className="px-2 py-1 text-right">{fmtMoney(l.beforeBalance)}</td>
                          <td className="px-2 py-1 text-right font-mono">
                            {Number(l.rateUsed).toFixed(4)}
                          </td>
                          <td className="px-2 py-1 text-right">{fmtMoney(l.afterBalance)}</td>
                          <td
                            className={`px-2 py-1 text-right font-medium ${l.gainLoss >= 0 ? 'text-emerald-700' : 'text-red-700'}`}
                          >
                            {fmtMoney(l.gainLoss)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          <F label="Notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </F>
          {error && (
            <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
              {error}
            </div>
          )}
          {preview && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
              Posting will create a JE on {fmtDate(asOfDate)} and an auto-reversing JE on the 1st of
              the following month. This action is logged.
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t bg-gray-50">
          <button onClick={onClose} className="px-4 py-2 text-sm hover:bg-white rounded-lg">
            Cancel
          </button>
          {preview && (
            <button
              onClick={post}
              disabled={posting}
              className="px-4 py-2 text-sm font-semibold bg-purple-700 text-white rounded-lg disabled:opacity-50"
            >
              {posting ? 'Posting…' : 'Post Revaluation'}
            </button>
          )}
        </div>
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
