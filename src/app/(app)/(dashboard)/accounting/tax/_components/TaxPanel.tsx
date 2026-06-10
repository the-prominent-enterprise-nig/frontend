'use client'
import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Star, RefreshCw, X, Loader2 } from 'lucide-react'
import { Tax, fmtMoney } from '@/src/libs/data/AccountingV2Data'
import {
  getTaxRates,
  createTaxRate,
  updateTaxRate,
  setDefaultTaxRate,
  clearDefaultTaxRate,
  deleteTaxRate,
  getAccounts,
  TAX_RATE_TYPES,
  type TaxRate,
  type TaxRateInput,
  type TaxRateType,
  type Account,
} from '@/src/libs/data/AccountingData'
import { hasPermission } from '@/src/hooks/usePermission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import { type SessionUser } from '@/src/libs/guards/permission'

const TODAY = new Date().toISOString().slice(0, 10)
const YEAR_START = new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10)

const GL_REQUIRED_TYPES: TaxRateType[] = ['vat', 'withholding']

// ─── Tax Rate Form Modal ───────────────────────────────────────────────────────

function TaxRateModal({
  initial,
  accounts,
  onClose,
  onSaved,
}: {
  initial: TaxRate | null
  accounts: Account[]
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!initial
  const [name, setName] = useState(initial?.name ?? '')
  const [rate, setRate] = useState(initial?.rate != null ? String(initial.rate) : '')
  const [type, setType] = useState<TaxRateType>(initial?.type ?? 'vat')
  const [glAccountId, setGlAccountId] = useState(initial?.glAccountId ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const glRequired = GL_REQUIRED_TYPES.includes(type)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!name.trim()) {
      setError('Name is required.')
      return
    }
    if (rate === '' || isNaN(Number(rate))) {
      setError('Rate must be a number.')
      return
    }
    if (glRequired && !glAccountId) {
      setError('GL Account is required for this tax type.')
      return
    }

    const data: TaxRateInput = {
      name: name.trim(),
      rate: Number(rate),
      type,
      glAccountId: glAccountId || undefined,
    }
    setSaving(true)
    const res = isEdit ? await updateTaxRate(initial!.id, data) : await createTaxRate(data)
    setSaving(false)
    if (!res.success) {
      setError(res.error ?? res.message ?? 'Save failed')
      return
    }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h3 className="text-base font-semibold text-gray-900">
            {isEdit ? 'Edit Tax Rate' : 'New Tax Rate'}
          </h3>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100">
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Name *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. VAT 12%"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Rate (%) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                placeholder="12.00"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Type *</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as TaxRateType)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              >
                {TAX_RATE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              GL Account {glRequired && <span className="text-red-500">*</span>}
            </label>
            <select
              value={glAccountId}
              onChange={(e) => setGlAccountId(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
            >
              <option value="">— None —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.number ?? a.code} — {a.name}
                </option>
              ))}
            </select>
            {!glRequired && (
              <p className="mt-1 text-[10px] text-gray-400">
                Optional for VAT Exempt and Zero Rated types.
              </p>
            )}
          </div>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-purple-800 disabled:opacity-50"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Configuration Tab ────────────────────────────────────────────────────────

function ConfigurationTab({ session }: { session: SessionUser | null }) {
  const [rates, setRates] = useState<TaxRate[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<TaxRate | null>(null)
  const [applyingId, setApplyingId] = useState<string | null>(null)
  const [applyResult, setApplyResult] = useState<{
    id: string
    message: string
    ok: boolean
  } | null>(null)
  // toggled[id] = true means the rate is currently applied to all items
  const [toggled, setToggled] = useState<Record<string, boolean>>({})

  const canCreate = hasPermission(session, ACCOUNTING_PERMISSIONS.TAX_CREATE)
  const canUpdate = hasPermission(session, ACCOUNTING_PERMISSIONS.TAX_UPDATE)
  const canDelete = hasPermission(session, ACCOUNTING_PERMISSIONS.TAX_DELETE)

  async function load() {
    setLoading(true)
    setError('')
    const [ratesRes, acctRes] = await Promise.all([getTaxRates(), getAccounts({ limit: 500 })])
    if (!ratesRes.success) {
      setError(ratesRes.error ?? 'Failed to load tax rates')
      setLoading(false)
      return
    }
    setRates((ratesRes.data as TaxRate[]) ?? [])
    if (acctRes.success && acctRes.data) {
      const d = acctRes.data as any
      setAccounts(d?.items ?? d ?? [])
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function handleSetDefault(id: string) {
    const res = await setDefaultTaxRate(id)
    if (!res.success) {
      alert(res.error ?? 'Failed to set default')
      return
    }
    load()
  }

  async function handleDelete(rate: TaxRate) {
    if (!confirm(`Delete "${rate.name}"? This cannot be undone.`)) return
    const res = await deleteTaxRate(rate.id)
    if (!res.success) {
      alert(res.error ?? res.message ?? 'Delete failed')
      return
    }
    load()
  }

  async function handleToggleApply(rate: TaxRate) {
    const isOn = toggled[rate.id] ?? rate.isDefault
    setApplyingId(rate.id)
    setApplyResult(null)
    const res = isOn ? await clearDefaultTaxRate(rate.id) : await setDefaultTaxRate(rate.id)
    setApplyingId(null)
    if (res.success) {
      setToggled((prev) => ({ ...prev, [rate.id]: !isOn }))
      setApplyResult({
        id: rate.id,
        message: isOn ? 'Tax removed from POS.' : 'Tax applied to POS.',
        ok: true,
      })
      load()
    } else {
      setApplyResult({ id: rate.id, message: res.message ?? 'Failed.', ok: false })
    }
  }

  const typeLabel = (t: TaxRateType) => TAX_RATE_TYPES.find((x) => x.value === t)?.label ?? t

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">
            Manage tax rates used across items, POS, and invoices.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-purple-600 hover:bg-purple-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          {canCreate && (
            <button
              onClick={() => setCreating(true)}
              className="flex items-center gap-1.5 rounded-lg bg-purple-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-800"
            >
              <Plus className="h-3.5 w-3.5" /> New Rate
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-right">Rate</th>
              <th className="px-4 py-3 text-left">GL Account</th>
              <th className="px-4 py-3 text-center">Usage</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-left">Apply to Items</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                  Loading…
                </td>
              </tr>
            ) : rates.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                  No tax rates configured yet.
                </td>
              </tr>
            ) : (
              rates.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <div className="flex items-center gap-2">
                      {r.name}
                      {r.isDefault && (
                        <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-200">
                          Default
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{typeLabel(r.type)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">{r.rate}%</td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {r.glAccount
                      ? `${r.glAccount.number ?? r.glAccount.code} — ${r.glAccount.name}`
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-center text-xs text-gray-500">
                    {r._count?.items ?? 0} item{(r._count?.items ?? 0) !== 1 ? 's' : ''}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium border ${r.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}
                    >
                      {r.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {r.isActive && (
                      <div className="flex flex-col gap-1">
                        <button
                          role="switch"
                          aria-checked={toggled[r.id] ?? r.isDefault}
                          onClick={() => handleToggleApply(r)}
                          disabled={applyingId === r.id}
                          title="Toggle to apply or remove this tax rate from the POS"
                          className="flex items-center gap-2 disabled:opacity-50 group"
                        >
                          {applyingId === r.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-600 shrink-0" />
                          ) : (
                            (() => {
                              const isOn = toggled[r.id] ?? r.isDefault
                              return (
                                <span
                                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border-2 transition-colors ${isOn ? 'bg-purple-600 border-purple-600' : 'bg-gray-200 border-gray-200 group-hover:border-purple-300'}`}
                                >
                                  <span
                                    className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${isOn ? 'translate-x-4' : 'translate-x-0.5'}`}
                                  />
                                </span>
                              )
                            })()
                          )}
                          <span className="text-xs text-gray-600 group-hover:text-gray-900 whitespace-nowrap">
                            Apply to all items
                          </span>
                        </button>
                        {applyResult?.id === r.id && (
                          <span
                            className={`text-xs ${applyResult.ok ? 'text-emerald-600' : 'text-red-600'}`}
                          >
                            {applyResult.message}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {canUpdate && !r.isDefault && (
                        <button
                          onClick={() => handleSetDefault(r.id)}
                          title="Set as default"
                          className="rounded p-1.5 text-gray-400 hover:bg-amber-50 hover:text-amber-600"
                        >
                          <Star className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {canUpdate && (
                        <button
                          onClick={() => setEditing(r)}
                          title="Edit"
                          className="rounded p-1.5 text-gray-400 hover:bg-purple-50 hover:text-purple-600"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => handleDelete(r)}
                          title="Delete"
                          className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
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
        <TaxRateModal
          initial={editing}
          accounts={accounts}
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
    </div>
  )
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export default function TaxPanel({ session }: { session?: SessionUser | null }) {
  const [tab, setTab] = useState<'config' | 'calc' | 'filing'>('config')
  const [amount, setAmount] = useState('1000')
  const [rate, setRate] = useState('12')
  const [calcResult, setCalcResult] = useState<any>(null)
  const [startDate, setStartDate] = useState(YEAR_START)
  const [endDate, setEndDate] = useState(TODAY)
  const [filing, setFiling] = useState<any>(null)

  const doCalc = async () => {
    const r = await Tax.calculate(Number(amount), Number(rate))
    setCalcResult(r.data)
  }
  const loadFiling = async () => {
    const r = await Tax.filingSummary(startDate, endDate)
    setFiling(r.data)
  }
  useEffect(() => {
    if (tab === 'filing') loadFiling()
  }, [tab])

  const tabCls = (t: string) =>
    `px-3 py-2 text-sm font-medium border-b-2 ${tab === t ? 'border-purple-600 text-purple-700' : 'border-transparent text-gray-600 hover:text-gray-900'}`

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold mb-1">Tax</h2>
      <p className="text-sm text-gray-500 mb-4">
        Tax rates, calculation tools, and filing summaries.
      </p>
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        <button onClick={() => setTab('config')} className={tabCls('config')}>
          Configuration
        </button>
        <button onClick={() => setTab('calc')} className={tabCls('calc')}>
          Calculator
        </button>
        <button onClick={() => setTab('filing')} className={tabCls('filing')}>
          Filing Summary
        </button>
      </div>

      {tab === 'config' && <ConfigurationTab session={session ?? null} />}

      {tab === 'calc' && (
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <label className="block">
              <span className="block text-xs font-medium text-gray-600 mb-1">Amount</span>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-gray-600 mb-1">Tax Rate (%)</span>
              <input
                type="number"
                step="0.01"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </label>
          </div>
          <button
            onClick={doCalc}
            className="px-4 py-2 text-sm font-semibold bg-purple-700 text-white rounded-lg"
          >
            Calculate
          </button>
          {calcResult && (
            <div className="mt-4 p-4 bg-purple-50 rounded-lg space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Amount:</span>
                <span className="font-semibold">{fmtMoney(calcResult.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tax ({calcResult.rate}%):</span>
                <span className="font-semibold">{fmtMoney(calcResult.tax)}</span>
              </div>
              <div className="flex justify-between border-t pt-1 text-base font-bold">
                <span>Total:</span>
                <span>{fmtMoney(calcResult.total)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'filing' && (
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <label className="block">
              <span className="block text-xs font-medium text-gray-600 mb-1">From</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-gray-600 mb-1">To</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </label>
          </div>
          <button
            onClick={loadFiling}
            className="px-4 py-2 text-sm font-semibold bg-purple-700 text-white rounded-lg"
          >
            Generate Summary
          </button>
          {filing && (
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="p-4 bg-emerald-50 rounded-lg">
                <div className="text-xs text-emerald-700">Output Tax (collected from AR)</div>
                <div className="text-xl font-bold">{fmtMoney(filing.outputTax)}</div>
              </div>
              <div className="p-4 bg-amber-50 rounded-lg">
                <div className="text-xs text-amber-700">Input Tax (paid on AP)</div>
                <div className="text-xl font-bold">{fmtMoney(filing.inputTax)}</div>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg">
                <div className="text-xs text-purple-700">Tax Payable</div>
                <div className="text-xl font-bold">{fmtMoney(filing.taxPayable)}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
