'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, RefreshCw, Pencil, Trash2, X } from 'lucide-react'
import { TaxRates, type TaxRate, type TaxRateType } from '@/src/libs/data/AccountingV2Data'

const TYPES: TaxRateType[] = ['VAT', 'EXEMPT', 'ZERO_RATED', 'WHT']
const TYPE_COLORS: Record<TaxRateType, string> = {
  VAT: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  EXEMPT: 'bg-gray-100 text-gray-600 border-gray-200',
  ZERO_RATED: 'bg-blue-50 text-blue-700 border-blue-200',
  WHT: 'bg-amber-50 text-amber-700 border-amber-200',
}

export default function TaxRatesList() {
  const [items, setItems] = useState<TaxRate[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<TaxRate | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await TaxRates.list()
    setItems(res.data ?? [])
    setLoading(false)
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const remove = async (id: string) => {
    await TaxRates.remove(id)
    setDeleteConfirm(null)
    load()
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Tax Rates</h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage sales tax rates (VAT, withholding, exempt, zero-rated). Used by items and
            invoices.
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
            <Plus className="w-4 h-4" /> New Tax Rate
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left">Code</th>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-right">Rate</th>
              <th className="px-3 py-2 text-left">Status</th>
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
                  No tax rates yet.
                </td>
              </tr>
            ) : (
              items.map((t) => (
                <tr key={t.id} className={t.isActive ? '' : 'opacity-50'}>
                  <td className="px-3 py-2 font-mono text-xs">{t.code}</td>
                  <td className="px-3 py-2 font-medium text-gray-900">{t.name}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium border ${TYPE_COLORS[t.type]}`}
                    >
                      {t.type.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {Number(t.ratePercent).toFixed(2)}%
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {t.isActive ? (
                      <span className="text-emerald-700">Active</span>
                    ) : (
                      <span className="text-gray-400">Inactive</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => setEditing(t)}
                        className="p-1.5 text-purple-600 hover:bg-purple-50 rounded"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      {deleteConfirm === t.id ? (
                        <>
                          <button
                            onClick={() => remove(t.id)}
                            className="px-2 py-1 text-xs font-semibold bg-red-600 text-white rounded"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="p-1 text-gray-500 hover:bg-gray-100 rounded"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        t.isActive && (
                          <button
                            onClick={() => setDeleteConfirm(t.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                            title="Deactivate"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )
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
        <TaxRateFormDialog
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
    </div>
  )
}

function TaxRateFormDialog({
  initial,
  onClose,
  onSaved,
}: {
  initial: TaxRate | null
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    code: initial?.code ?? '',
    name: initial?.name ?? '',
    ratePercent: String(initial?.ratePercent ?? '0'),
    type: (initial?.type ?? 'VAT') as TaxRateType,
    description: initial?.description ?? '',
    isActive: initial?.isActive ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const payload = {
      code: form.code.trim(),
      name: form.name.trim(),
      ratePercent: Number(form.ratePercent),
      type: form.type,
      description: form.description || undefined,
      isActive: form.isActive,
    }
    const res = initial
      ? await TaxRates.update(initial.id, payload)
      : await TaxRates.create(payload)
    setSaving(false)
    if (!res.success) {
      setError(res.message || res.error || 'Save failed')
      return
    }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="text-lg font-semibold">{initial ? 'Edit Tax Rate' : 'New Tax Rate'}</h3>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Code *">
              <input
                required
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="VAT_12"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg uppercase"
              />
            </Field>
            <Field label="Type *">
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as TaxRateType })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Name *">
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Standard VAT 12%"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </Field>
          <Field label="Rate (%) *">
            <input
              required
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={form.ratePercent}
              onChange={(e) => setForm({ ...form, ratePercent: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </Field>
          <Field label="Description">
            <textarea
              value={form.description ?? ''}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            <span>Active</span>
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
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-600 mb-1">{label}</span>
      {children}
    </label>
  )
}
