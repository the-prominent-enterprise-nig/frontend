'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Pencil, Plus } from 'lucide-react'
import { TaxCodes, type TaxCode } from '@/src/libs/data/AccountingV2Data'
import {
  POSTING_KEYS_BY_TAX_TYPE,
  TAX_BASE_RULE_LABELS,
  TAX_CODE_TYPE_LABELS,
  fmtRate,
  usePostingKeyLabels,
} from '../../_components/taxCodeLabels'

const STATUS_STYLE: Record<TaxCode['status'], string> = {
  CURRENT: 'bg-green-50 text-green-700',
  UPCOMING: 'bg-amber-50 text-amber-800',
  ENDED: 'bg-gray-100 text-gray-600',
}
const STATUS_LABEL: Record<TaxCode['status'], string> = {
  CURRENT: 'In force',
  UPCOMING: 'Upcoming',
  ENDED: 'Ended',
}

// Scenario 69 Part C — one tax code and every version of it. The rate, what it
// applies to and the dates are fixed per version; a rate change is a new
// version (the form on /new), so a transaction keeps the rate in force on its
// own date. What can be edited in place is the name, ATC, posting account and
// flags — on a form below the table, not in a pop-up.
export default function TaxCodeDetail({
  code,
  canEdit,
  canAddVersion,
  justSaved,
}: {
  code: string
  canEdit: boolean
  canAddVersion: boolean
  justSaved: boolean
}) {
  const { labels: postingLabels, ready: labelsReady } = usePostingKeyLabels()
  const [versions, setVersions] = useState<TaxCode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(justSaved ? 'Saved.' : null)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Bumped to re-read the history after a save or a switch.
  const [reloadKey, setReloadKey] = useState(0)
  const reload = () => setReloadKey((k) => k + 1)

  useEffect(() => {
    let cancelled = false
    TaxCodes.history(code).then((res) => {
      if (cancelled) return
      if (res.success && res.data) {
        setVersions(res.data)
        setError(null)
      } else {
        setError(res.message || res.error || 'Could not load this tax code')
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [code, reloadKey])

  // Newest first. The one to describe at the top is the one in force, else the
  // next one scheduled, else the latest that ended.
  const headline =
    versions.find((v) => v.status === 'CURRENT') ??
    [...versions].reverse().find((v) => v.status === 'UPCOMING') ??
    versions[0]
  const editing = versions.find((v) => v.id === editingId) ?? null
  // Blank until the labels have loaded, so the raw key never flashes.
  const postsTo = (key: string | null) =>
    key ? (labelsReady ? (postingLabels.get(key) ?? key) : '') : 'No tax posted'

  const setActive = async (active: boolean) => {
    if (!headline) return
    setError(null)
    const res = await TaxCodes.update(headline.id, { isActive: active })
    if (!res.success) {
      setError(res.message || res.error || 'Could not change this code')
      return
    }
    setNotice(active ? 'Code reactivated.' : 'Code deactivated.')
    reload()
  }

  return (
    <div className="px-6 py-6 lg:px-10">
      <Link
        href="/accounting/tax-codes"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" /> Back to tax codes
      </Link>

      {error && (
        <div className="mb-3 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          {error}
        </div>
      )}
      {notice && (
        <div className="mb-3 rounded border border-green-200 bg-green-50 p-2 text-xs text-green-800">
          {notice}
        </div>
      )}

      {loading && !headline ? (
        <p className="py-10 text-center text-sm text-gray-400">Loading...</p>
      ) : !headline ? null : (
        <>
          <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-prominent-purple-900">
                <span className="font-mono">{headline.code}</span>
              </h1>
              <p className="mt-1 text-sm text-gray-700">{headline.name}</p>
              <p className="mt-1 text-sm text-gray-500">
                {TAX_CODE_TYPE_LABELS[headline.taxType]} &middot;{' '}
                {fmtRate(headline.ratePercent, headline.baseRule)} &middot;{' '}
                {TAX_BASE_RULE_LABELS[headline.baseRule]}
                {headline.accountMappingKey ? ' · posts to ' : ' · '}
                {postsTo(headline.accountMappingKey)}
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {headline.isDefault && (
                  <span className="rounded bg-purple-50 px-1.5 py-0.5 text-[11px] font-medium text-purple-700">
                    Default
                  </span>
                )}
                {headline.requiresApproval && (
                  <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">
                    Needs approval
                  </span>
                )}
                {!headline.isActive && (
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-600">
                    Inactive
                  </span>
                )}
              </div>
              {headline.description && (
                <p className="mt-3 max-w-3xl text-[13px] text-gray-600">{headline.description}</p>
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              {canEdit && (
                <button
                  onClick={() => setActive(!headline.isActive)}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  {headline.isActive ? 'Deactivate code' : 'Reactivate code'}
                </button>
              )}
              {canAddVersion && (
                <Link
                  href={`/accounting/tax-codes/new?code=${encodeURIComponent(headline.code)}`}
                  className="flex items-center gap-2 rounded-lg bg-purple-700 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-800"
                >
                  <Plus className="h-4 w-4" /> Add a new version
                </Link>
              )}
            </div>
          </div>

          <h2 className="mb-2 text-[14px] font-semibold text-prominent-purple-900">Versions</h2>
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-600">
                <tr>
                  <th className="px-3 py-2 text-left">From</th>
                  <th className="px-3 py-2 text-left">To</th>
                  <th className="px-3 py-2 text-right">Rate</th>
                  <th className="px-3 py-2 text-left">Applied to</th>
                  <th className="px-3 py-2 text-left">ATC</th>
                  <th className="px-3 py-2 text-left">Posts to</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  {canEdit && <th className="px-3 py-2 text-right">Edit</th>}
                </tr>
              </thead>
              <tbody>
                {versions.map((v) => (
                  <tr
                    key={v.id}
                    className={`border-t border-gray-100 ${v.id === editingId ? 'bg-purple-50/50' : ''}`}
                  >
                    <td className="px-3 py-2 tabular-nums">{v.effectiveFrom}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {v.effectiveTo ?? <span className="text-gray-400">Open</span>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {fmtRate(v.ratePercent, v.baseRule)}
                    </td>
                    <td className="px-3 py-2 text-gray-600">{TAX_BASE_RULE_LABELS[v.baseRule]}</td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {v.atc ?? <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-3 py-2 text-gray-600">{postsTo(v.accountMappingKey)}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${STATUS_STYLE[v.status]}`}
                      >
                        {STATUS_LABEL[v.status]}
                      </span>
                    </td>
                    {canEdit && (
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => {
                            setNotice(null)
                            setEditingId(v.id === editingId ? null : v.id)
                          }}
                          title="Edit this version"
                          aria-label={`Edit the version starting ${v.effectiveFrom}`}
                          className="rounded p-1.5 text-gray-500 hover:bg-purple-50 hover:text-purple-700"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[12px] text-gray-500">
            The rate, what it applies to and the dates are fixed for a version. To change a rate,
            add a new version &mdash; the one before it ends the day before.
          </p>

          {editing && (
            <EditVersion
              key={editing.id}
              version={editing}
              postingLabels={postingLabels}
              onCancel={() => setEditingId(null)}
              onSaved={() => {
                setEditingId(null)
                setNotice('Saved.')
                reload()
              }}
            />
          )}
        </>
      )}
    </div>
  )
}

function EditVersion({
  version,
  postingLabels,
  onCancel,
  onSaved,
}: {
  version: TaxCode
  postingLabels: Map<string, string>
  onCancel: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    name: version.name,
    atc: version.atc ?? '',
    accountMappingKey: version.accountMappingKey ?? '',
    description: version.description ?? '',
    isDefault: version.isDefault,
    requiresApproval: version.requiresApproval,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const allowed = POSTING_KEYS_BY_TAX_TYPE[version.taxType]
  const keys = new Set<string>(allowed === 'ANY' ? [...postingLabels.keys()] : allowed)
  if (version.accountMappingKey) keys.add(version.accountMappingKey)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const res = await TaxCodes.update(version.id, {
      name: form.name,
      atc: form.atc.trim() || null,
      accountMappingKey: form.accountMappingKey || null,
      description: form.description.trim() || null,
      isDefault: form.isDefault,
      requiresApproval: form.requiresApproval,
    })
    setSaving(false)
    if (!res.success) {
      setError(res.message || res.error || 'Could not save')
      return
    }
    onSaved()
  }

  return (
    <form
      onSubmit={submit}
      className="mt-5 space-y-4 rounded-xl border border-purple-200 bg-white p-5"
    >
      <h2 className="text-[14px] font-semibold text-prominent-purple-900">
        Edit the version starting {version.effectiveFrom}
      </h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-600">Name *</span>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-600">ATC</span>
          <input
            value={form.atc}
            onChange={(e) => setForm({ ...form, atc: e.target.value })}
            placeholder="Not set"
            maxLength={20}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-sm uppercase placeholder:normal-case"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-600">Posts to</span>
          <select
            value={form.accountMappingKey}
            onChange={(e) => setForm({ ...form, accountMappingKey: e.target.value })}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
          >
            <option value="">No tax posted</option>
            {[...keys].map((k) => (
              <option key={k} value={k}>
                {postingLabels.get(k) ?? k}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-gray-600">Description</span>
        <textarea
          rows={3}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
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
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-purple-700 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-800 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  )
}
