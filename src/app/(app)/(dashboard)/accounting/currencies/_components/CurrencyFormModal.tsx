'use client'

import { useState } from 'react'
import { Currency, createCurrency, updateCurrency } from '@/src/libs/data/AccountingData'
import { showToast } from '@/src/components/ui/toast'
import { Modal } from '../../_shared/Modal'
import { Field, inputClass } from '../../_shared/ListShell'

interface Props {
  currency: Currency | null
  onClose: () => void
  onSaved: () => void
}

export function CurrencyFormModal({ currency, onClose, onSaved }: Props) {
  const isEdit = !!currency
  // Backend Currency model uses: name, code, rate, mainCurrency, visibility.
  // The Currency type on the frontend exposes legacy aliases; map both ways.
  const c = currency as
    | (Currency & { rate?: number; mainCurrency?: boolean; visibility?: boolean })
    | null
  const [form, setForm] = useState({
    code: c?.code ?? '',
    name: c?.name ?? '',
    rate: c?.rate ?? c?.exchangeRate ?? 1,
    mainCurrency: c?.mainCurrency ?? c?.isBase ?? false,
    visibility: c?.visibility ?? c?.isActive ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleSave = async () => {
    const e: Record<string, string> = {}
    if (!form.code.trim()) e.code = 'Code is required'
    if (!form.name.trim()) e.name = 'Name is required'
    setErrors(e)
    if (Object.keys(e).length) return

    setSaving(true)
    const payload = {
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      rate: Number(form.rate) || 1,
      mainCurrency: form.mainCurrency,
      visibility: form.visibility,
    }
    const res = isEdit ? await updateCurrency(currency!.id, payload) : await createCurrency(payload)
    setSaving(false)
    if (res.success) {
      showToast({
        status: 'success',
        title: isEdit ? 'Currency updated' : 'Currency created',
      })
      onSaved()
    } else {
      showToast({
        status: 'error',
        title: 'Save failed',
        description: res.message,
      })
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'Edit currency' : 'Add currency'}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-prominent-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Create currency'}
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Code" required error={errors.code}>
          <input
            className={inputClass}
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            placeholder="PHP"
          />
        </Field>
        <Field label="Name" required error={errors.name}>
          <input
            className={inputClass}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Philippine Peso"
          />
        </Field>
        <Field label="Exchange rate (vs base)">
          <input
            type="number"
            step="0.0001"
            className={inputClass}
            value={form.rate ?? 0}
            onChange={(e) => setForm({ ...form, rate: Number(e.target.value) })}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={form.mainCurrency}
            onChange={(e) => setForm({ ...form, mainCurrency: e.target.checked })}
            className="h-4 w-4 rounded border-gray-300 text-prominent-purple-600"
          />
          Base currency
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={form.visibility}
            onChange={(e) => setForm({ ...form, visibility: e.target.checked })}
            className="h-4 w-4 rounded border-gray-300 text-prominent-purple-600"
          />
          Visible
        </label>
      </div>
    </Modal>
  )
}
