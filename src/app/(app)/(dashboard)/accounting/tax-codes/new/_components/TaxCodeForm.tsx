'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import {
  TaxCodes,
  type TaxBaseRule,
  type TaxCode,
  type TaxCodeType,
} from '@/src/libs/data/AccountingV2Data'
import {
  POSTING_KEYS_BY_TAX_TYPE,
  TAX_BASE_RULES,
  TAX_BASE_RULE_LABELS,
  TAX_CODE_TYPES,
  TAX_CODE_TYPE_LABELS,
  usePostingKeyLabels,
} from '../../_components/taxCodeLabels'

const dayAfter = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

const emptyForm = () => ({
  code: '',
  name: '',
  taxType: 'EWT_PAYABLE' as TaxCodeType,
  ratePercent: '',
  baseRule: 'NET_OF_VAT' as TaxBaseRule,
  accountMappingKey: '',
  atc: '',
  description: '',
  effectiveFrom: '',
  effectiveTo: '',
  isDefault: false,
  requiresApproval: false,
})

// Scenario 69 Part C — adds a tax code, or (with ?code=…) a NEW VERSION of one
// that exists: the way a rate changes. The code and its type are then fixed,
// and the current version ends the day before this one starts, so a
// transaction dated before keeps the old rate. A full page, not a pop-up.
export default function TaxCodeForm({ versionOf }: { versionOf?: string }) {
  const router = useRouter()
  const { labels: postingLabels } = usePostingKeyLabels()
  const [form, setForm] = useState(emptyForm)
  const [latest, setLatest] = useState<TaxCode | null>(null)
  const [loading, setLoading] = useState(!!versionOf)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // A new version starts from the code's latest version, so only what
  // changes has to be typed.
  useEffect(() => {
    if (!versionOf) return
    TaxCodes.history(versionOf).then((res) => {
      if (res.success && res.data?.length) {
        const v = res.data[0]
        setLatest(v)
        setForm({
          code: v.code,
          name: v.name,
          taxType: v.taxType,
          ratePercent: String(v.ratePercent),
          baseRule: v.baseRule,
          accountMappingKey: v.accountMappingKey ?? '',
          atc: v.atc ?? '',
          description: v.description ?? '',
          effectiveFrom: '',
          effectiveTo: '',
          isDefault: v.isDefault,
          requiresApproval: v.requiresApproval,
        })
      } else {
        setError(res.message || res.error || `Tax code ${versionOf} was not found`)
      }
      setLoading(false)
    })
  }, [versionOf])

  const allowed = POSTING_KEYS_BY_TAX_TYPE[form.taxType]
  const postingKeys = useMemo(
    () => (allowed === 'ANY' ? [...postingLabels.keys()] : allowed),
    [allowed, postingLabels]
  )

  const minFrom = latest ? dayAfter(latest.effectiveFrom) : undefined

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const rate = Number(form.ratePercent)
    if (form.ratePercent === '' || Number.isNaN(rate) || rate < 0 || rate > 100) {
      setError('Rate must be a percentage from 0 to 100.')
      return
    }
    setSaving(true)
    setError(null)
    const res = await TaxCodes.create({
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      taxType: form.taxType,
      ratePercent: rate,
      baseRule: form.baseRule,
      accountMappingKey: form.accountMappingKey || null,
      atc: form.atc.trim() || null,
      description: form.description.trim() || null,
      isDefault: form.isDefault,
      requiresApproval: form.requiresApproval,
      effectiveFrom: form.effectiveFrom,
      effectiveTo: form.effectiveTo || null,
    })
    setSaving(false)
    if (!res.success || !res.data) {
      setError(res.message || res.error || 'Could not save this tax code')
      return
    }
    router.push(`/accounting/tax-codes/${encodeURIComponent(res.data.code)}?saved=1`)
  }

  const input = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm'

  return (
    <div className="px-6 py-6 lg:px-10">
      <Link
        href={
          versionOf
            ? `/accounting/tax-codes/${encodeURIComponent(versionOf)}`
            : '/accounting/tax-codes'
        }
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" /> Back to {versionOf ? versionOf : 'tax codes'}
      </Link>

      <h1 className="text-2xl font-bold text-prominent-purple-900">
        {versionOf ? `New version of ${versionOf}` : 'New Tax Code'}
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        {versionOf
          ? 'Use this to change a rate. The current version ends the day before this one starts, and a transaction keeps the rate in force on its own date.'
          : 'A code names one tax treatment — e.g. EWT on rent at 5% — and says where its tax is posted.'}
      </p>

      {loading ? (
        <p className="py-10 text-center text-sm text-gray-400">Loading...</p>
      ) : (
        <form
          onSubmit={submit}
          className="mt-6 space-y-4 rounded-xl border border-gray-200 bg-white p-6"
        >
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">Code *</span>
              <input
                required
                disabled={!!versionOf}
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="e.g. EWT-RENT-5"
                maxLength={40}
                className={`${input} font-mono disabled:bg-gray-50 disabled:text-gray-500`}
              />
            </label>
            <label className="block lg:col-span-2">
              <span className="mb-1 block text-xs font-medium text-gray-600">Name *</span>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={input}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">Type *</span>
              <select
                disabled={!!versionOf}
                value={form.taxType}
                onChange={(e) => {
                  const taxType = e.target.value as TaxCodeType
                  const ok = POSTING_KEYS_BY_TAX_TYPE[taxType]
                  setForm({
                    ...form,
                    taxType,
                    accountMappingKey:
                      ok === 'ANY' || ok.includes(form.accountMappingKey)
                        ? form.accountMappingKey
                        : '',
                  })
                }}
                className={`${input} bg-white disabled:bg-gray-50 disabled:text-gray-500`}
              >
                {TAX_CODE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TAX_CODE_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">Rate (%) *</span>
              <input
                required
                type="number"
                step="0.0001"
                min="0"
                max="100"
                value={form.ratePercent}
                onChange={(e) => setForm({ ...form, ratePercent: e.target.value })}
                className={input}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">
                Rate applies to *
              </span>
              <select
                value={form.baseRule}
                onChange={(e) => setForm({ ...form, baseRule: e.target.value as TaxBaseRule })}
                className={`${input} bg-white`}
              >
                {TAX_BASE_RULES.map((b) => (
                  <option key={b} value={b}>
                    {TAX_BASE_RULE_LABELS[b]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">Posts to</span>
              <select
                value={form.accountMappingKey}
                onChange={(e) => setForm({ ...form, accountMappingKey: e.target.value })}
                className={`${input} bg-white`}
              >
                <option value="">No tax posted</option>
                {postingKeys.map((k) => (
                  <option key={k} value={k}>
                    {postingLabels.get(k) ?? k}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">ATC</span>
              <input
                value={form.atc}
                onChange={(e) => setForm({ ...form, atc: e.target.value })}
                placeholder="Not set"
                maxLength={20}
                className={`${input} font-mono uppercase placeholder:normal-case`}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">Effective from *</span>
              <input
                required
                type="date"
                min={minFrom}
                value={form.effectiveFrom}
                onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })}
                className={input}
              />
              {latest && (
                <span className="mt-1 block text-[12px] text-gray-500">
                  The latest version starts {latest.effectiveFrom}; this one must start after it.
                </span>
              )}
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">
                Effective to (optional)
              </span>
              <input
                type="date"
                min={form.effectiveFrom || undefined}
                value={form.effectiveTo}
                onChange={(e) => setForm({ ...form, effectiveTo: e.target.value })}
                className={input}
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600">Description</span>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className={input}
            />
          </label>

          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
              />
              Default for its type
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.requiresApproval}
                onChange={(e) => setForm({ ...form, requiresApproval: e.target.checked })}
              />
              Needs approval before it is used
            </label>
          </div>

          {error && (
            <div className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2 border-t pt-3">
            <Link
              href={
                versionOf
                  ? `/accounting/tax-codes/${encodeURIComponent(versionOf)}`
                  : '/accounting/tax-codes'
              }
              className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-purple-700 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-800 disabled:opacity-50"
            >
              {saving ? 'Saving…' : versionOf ? 'Add version' : 'Create tax code'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
