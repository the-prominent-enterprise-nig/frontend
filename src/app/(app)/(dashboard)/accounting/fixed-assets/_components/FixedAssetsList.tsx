'use client'
import { useCallback, useEffect, useState } from 'react'
import {
  Plus,
  RefreshCw,
  Pencil,
  PackageMinus,
  Calculator,
  X,
  History as HistoryIcon,
} from 'lucide-react'
import {
  FixedAssetsV2,
  type FixedAssetV2,
  type DepreciationMethod,
  type FixedAssetHistoryRecord,
  fmtMoney,
  fmtDate,
} from '@/src/libs/data/AccountingV2Data'

const METHOD_LABELS: Record<DepreciationMethod, string> = {
  STRAIGHT_LINE: 'Straight Line',
  DECLINING_BALANCE: 'Declining Balance',
  UNITS_OF_PRODUCTION: 'Units of Production',
}

export default function FixedAssetsList() {
  const [items, setItems] = useState<FixedAssetV2[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<FixedAssetV2 | null>(null)
  const [disposing, setDisposing] = useState<FixedAssetV2 | null>(null)
  const [historyFor, setHistoryFor] = useState<FixedAssetV2 | null>(null)
  const [creating, setCreating] = useState(false)
  const [depRunning, setDepRunning] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const r = await FixedAssetsV2.list()
    setItems(r.data ?? [])
    setLoading(false)
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const runDep = async (mode: 'MONTHLY' | 'ANNUAL') => {
    if (
      !confirm(
        `Run ${mode.toLowerCase()} depreciation for all active assets? This will post a consolidated journal entry.`
      )
    )
      return
    setDepRunning(true)
    const r = await FixedAssetsV2.runDepreciation({ mode })
    setDepRunning(false)
    if (!r.success) {
      alert(r.message || r.error || 'Failed')
      return
    }
    const data = r.data
    alert(
      `Processed ${data?.processed ?? 0} assets, total depreciation ₱${(data?.totalDepreciation ?? 0).toFixed(2)}. JE: ${data?.journalEntryId ?? 'none'}`
    )
    load()
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold">Fixed Assets</h2>
          <p className="text-sm text-gray-500">
            Asset register, depreciation runs (with auto-JE), and disposal.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => runDep('MONTHLY')}
            disabled={depRunning}
            className="flex items-center gap-2 px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-50 rounded-lg disabled:opacity-50"
          >
            <Calculator className="w-4 h-4" /> {depRunning ? 'Running…' : 'Run Monthly Dep'}
          </button>
          <button
            onClick={() => runDep('ANNUAL')}
            disabled={depRunning}
            className="flex items-center gap-2 px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-50 rounded-lg disabled:opacity-50"
          >
            <Calculator className="w-4 h-4" /> Run Annual Dep
          </button>
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
            <Plus className="w-4 h-4" /> Add Asset
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left">Code</th>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Method</th>
              <th className="px-3 py-2 text-left">Acquired</th>
              <th className="px-3 py-2 text-right">Cost</th>
              <th className="px-3 py-2 text-right">Accum. Dep.</th>
              <th className="px-3 py-2 text-right">Book Value</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-gray-400">
                  Loading...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-gray-400">
                  No fixed assets.
                </td>
              </tr>
            ) : (
              items.map((a) => (
                <tr key={a.id}>
                  <td className="px-3 py-2 font-mono text-xs">{a.assetCode}</td>
                  <td className="px-3 py-2 font-medium">{a.name}</td>
                  <td className="px-3 py-2 text-xs">{METHOD_LABELS[a.depreciationMethod]}</td>
                  <td className="px-3 py-2 text-xs">{fmtDate(a.acquisitionDate)}</td>
                  <td className="px-3 py-2 text-right">{fmtMoney(a.acquisitionCost)}</td>
                  <td className="px-3 py-2 text-right">{fmtMoney(a.accumulatedDepreciation)}</td>
                  <td className="px-3 py-2 text-right font-medium">{fmtMoney(a.bookValue)}</td>
                  <td className="px-3 py-2 text-xs">
                    {a.status === 'ACTIVE' ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Active
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
                        Disposed
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => setHistoryFor(a)}
                        className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"
                        title="History"
                      >
                        <HistoryIcon className="w-4 h-4" />
                      </button>
                      {a.status === 'ACTIVE' && (
                        <>
                          <button
                            onClick={() => setEditing(a)}
                            className="p-1.5 text-purple-600 hover:bg-purple-50 rounded"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDisposing(a)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                            title="Dispose"
                          >
                            <PackageMinus className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {(creating || editing) && (
        <AssetForm
          initial={editing}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
          onSaved={() => {
            setCreating(false)
            setEditing(null)
            load()
          }}
        />
      )}
      {disposing && (
        <DisposeDialog
          asset={disposing}
          onClose={() => setDisposing(null)}
          onSaved={() => {
            setDisposing(null)
            load()
          }}
        />
      )}
      {historyFor && <HistoryDialog asset={historyFor} onClose={() => setHistoryFor(null)} />}
    </div>
  )
}

function AssetForm({
  initial,
  onClose,
  onSaved,
}: {
  initial: FixedAssetV2 | null
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    description: initial?.description ?? '',
    category: initial?.category ?? '',
    acquisitionDate:
      initial?.acquisitionDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    acquisitionCost: String(initial?.acquisitionCost ?? ''),
    salvageValue: String(initial?.salvageValue ?? 0),
    usefulLifeMonths: String(initial?.usefulLifeMonths ?? 60),
    depreciationMethod: (initial?.depreciationMethod ?? 'STRAIGHT_LINE') as DepreciationMethod,
    decliningBalanceRate: String(initial?.decliningBalanceRate ?? ''),
    totalProductionUnits: String(initial?.totalProductionUnits ?? ''),
    costCenter: initial?.costCenter ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const payload: any = {
      ...form,
      acquisitionCost: Number(form.acquisitionCost),
      salvageValue: Number(form.salvageValue),
      usefulLifeMonths: Number(form.usefulLifeMonths),
    }
    if (form.depreciationMethod === 'DECLINING_BALANCE' && form.decliningBalanceRate) {
      payload.decliningBalanceRate = Number(form.decliningBalanceRate)
    } else delete payload.decliningBalanceRate
    if (form.depreciationMethod === 'UNITS_OF_PRODUCTION' && form.totalProductionUnits) {
      payload.totalProductionUnits = Number(form.totalProductionUnits)
    } else delete payload.totalProductionUnits

    const r = initial
      ? await FixedAssetsV2.update(initial.id, payload)
      : await FixedAssetsV2.create(payload)
    setSaving(false)
    if (!r.success) {
      setError(r.message || r.error || 'Save failed')
      return
    }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-white">
          <h3 className="text-lg font-semibold">{initial ? 'Edit Asset' : 'New Fixed Asset'}</h3>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <F label="Name *">
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </F>
          <F label="Description">
            <textarea
              value={form.description ?? ''}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </F>
          <div className="grid grid-cols-2 gap-3">
            <F label="Category">
              <input
                value={form.category ?? ''}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="Equipment, Vehicle..."
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </F>
            <F label="Acquisition Date *">
              <input
                required
                type="date"
                value={form.acquisitionDate}
                onChange={(e) => setForm({ ...form, acquisitionDate: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </F>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <F label="Cost *">
              <input
                required
                type="number"
                step="0.01"
                value={form.acquisitionCost}
                onChange={(e) => setForm({ ...form, acquisitionCost: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </F>
            <F label="Salvage Value">
              <input
                type="number"
                step="0.01"
                value={form.salvageValue}
                onChange={(e) => setForm({ ...form, salvageValue: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </F>
            <F label="Life (months) *">
              <input
                required
                type="number"
                value={form.usefulLifeMonths}
                onChange={(e) => setForm({ ...form, usefulLifeMonths: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </F>
          </div>
          <F label="Depreciation Method *">
            <select
              value={form.depreciationMethod}
              onChange={(e) =>
                setForm({ ...form, depreciationMethod: e.target.value as DepreciationMethod })
              }
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            >
              {(Object.keys(METHOD_LABELS) as DepreciationMethod[]).map((m) => (
                <option key={m} value={m}>
                  {METHOD_LABELS[m]}
                </option>
              ))}
            </select>
          </F>
          {form.depreciationMethod === 'DECLINING_BALANCE' && (
            <F label="Declining Balance Rate (e.g. 0.20 = 20%/yr)">
              <input
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={form.decliningBalanceRate}
                onChange={(e) => setForm({ ...form, decliningBalanceRate: e.target.value })}
                placeholder="Leave blank for double-declining"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </F>
          )}
          {form.depreciationMethod === 'UNITS_OF_PRODUCTION' && (
            <F label="Total Production Units *">
              <input
                type="number"
                value={form.totalProductionUnits}
                onChange={(e) => setForm({ ...form, totalProductionUnits: e.target.value })}
                placeholder="e.g. 100000 hours, 500000 units"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </F>
          )}
          <F label="Cost Center">
            <input
              value={form.costCenter ?? ''}
              onChange={(e) => setForm({ ...form, costCenter: e.target.value })}
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

function DisposeDialog({
  asset,
  onClose,
  onSaved,
}: {
  asset: FixedAssetV2
  onClose: () => void
  onSaved: () => void
}) {
  const [proceeds, setProceeds] = useState('0')
  const [disposalDate, setDisposalDate] = useState(new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nbv = asset.bookValue
  const gainLoss = (Number(proceeds) || 0) - nbv

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const r = await FixedAssetsV2.dispose(asset.id, { proceeds: Number(proceeds), disposalDate })
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
            <h3 className="text-lg font-semibold">Dispose Asset</h3>
            <p className="text-xs text-gray-500">
              {asset.assetCode} — {asset.name}
            </p>
          </div>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <div className="text-sm text-gray-600">
            Net Book Value: <span className="font-semibold text-gray-900">{fmtMoney(nbv)}</span>
          </div>
          <F label="Disposal Date *">
            <input
              required
              type="date"
              value={disposalDate}
              onChange={(e) => setDisposalDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </F>
          <F label="Proceeds *">
            <input
              required
              type="number"
              step="0.01"
              min="0"
              value={proceeds}
              onChange={(e) => setProceeds(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </F>
          <div
            className={`p-3 rounded-lg text-sm ${gainLoss >= 0 ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'}`}
          >
            {gainLoss >= 0 ? 'Gain' : 'Loss'} on disposal:{' '}
            <span className="font-bold">{fmtMoney(Math.abs(gainLoss))}</span>
            <div className="text-xs mt-1 opacity-80">
              Will post to {gainLoss >= 0 ? 'FA_DISPOSAL_GAIN' : 'FA_DISPOSAL_LOSS'} (set in Account
              Mapping).
            </div>
          </div>
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
              className="px-4 py-2 text-sm font-semibold bg-red-700 text-white rounded-lg disabled:opacity-50"
            >
              {saving ? 'Disposing…' : 'Confirm Disposal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function HistoryDialog({ asset, onClose }: { asset: FixedAssetV2; onClose: () => void }) {
  const [logs, setLogs] = useState<FixedAssetHistoryRecord[] | null>(null)
  useEffect(() => {
    FixedAssetsV2.history(asset.id).then((r) => setLogs(r.data ?? []))
  }, [asset.id])
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h3 className="text-lg font-semibold">Asset History</h3>
            <p className="text-xs text-gray-500">
              {asset.assetCode} — {asset.name}
            </p>
          </div>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-5 max-h-96 overflow-y-auto">
          {logs === null ? (
            <div className="text-gray-400 text-sm">Loading…</div>
          ) : logs.length === 0 ? (
            <div className="text-gray-400 text-sm italic">No history yet.</div>
          ) : (
            <div className="space-y-2">
              {logs.map((l) => (
                <div key={l.id} className="p-3 border border-gray-200 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-purple-50 text-purple-700">
                      {l.type}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(l.occurredAt).toLocaleString('en-PH')}
                    </span>
                  </div>
                  {l.amount != null && (
                    <div className="text-sm font-semibold text-gray-900">{fmtMoney(l.amount)}</div>
                  )}
                  {l.description && (
                    <div className="text-sm text-gray-700 mt-1">{l.description}</div>
                  )}
                  {l.performedBy && (
                    <div className="text-xs text-gray-500 mt-1">by {l.performedBy}</div>
                  )}
                  {l.journalEntryId && (
                    <div className="text-xs font-mono text-gray-500 mt-1">
                      JE: {l.journalEntryId.slice(0, 8)}
                    </div>
                  )}
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

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-600 mb-1">{label}</span>
      {children}
    </label>
  )
}
