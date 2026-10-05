'use client'

import { useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { updateReceivingReport } from '../../../inventory/goods-receiving/_actions/update-receiving-report'
import { receivingReportReasonLabel } from '@/src/libs/format/receiving-report'
import type { ReceivingReport } from '@/src/schema/inventory/goods-receiving'

type Props = {
  id: string
  record: ReceivingReport
  onCancel: () => void
  onSaved: () => void
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-500">
        {label}
      </span>
      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900">
        {value || '—'}
      </div>
    </div>
  )
}

/**
 * Correcting a repair/return or repossession receipt. These carry none of a
 * supplier delivery's paperwork — no SI, DR, SRP, discounts or tax — so the
 * supplier correction form is the wrong screen for them. What a return has is
 * who brought the units back and which units, and those moved stock when the
 * receipt posted, so they are shown but not editable. Only the notes can be
 * corrected.
 */
export default function ReturnReceiptEditForm({ id, record, onCancel, onSaved }: Props) {
  const [notes, setNotes] = useState(record.notes ?? '')
  const [saving, setSaving] = useState(false)

  const isRepo = record.reason === 'repossession'
  const units = (record.lines ?? []).flatMap((l) =>
    (l.serialNumbers?.length ? l.serialNumbers : ['—']).map((serial) => ({
      key: `${l.id}-${serial}`,
      serial,
      name: l.item?.name ?? '—',
    }))
  )

  const save = async () => {
    setSaving(true)
    const res = await updateReceivingReport(id, {
      notes: notes || undefined,
    })
    setSaving(false)
    if (!res.success) return alert(res.message || res.error || 'Could not save')
    onSaved()
  }

  return (
    <section className="mt-3 rounded-lg border border-purple-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[14px] font-semibold text-prominent-purple-900">
          Edit {isRepo ? 'repossession' : 'repair / return'} receipt
        </h2>
        <span className="text-[11px] text-amber-700">
          Units and customer are fixed once posted — only the notes can change
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Fact label="Reason" value={receivingReportReasonLabel(record)} />
        <Fact label={isRepo ? 'Repossessed from' : 'Returned by'} value={record.returnedBy?.name} />
        <Fact label="Customer ID" value={record.returnedBy?.customerCode} />
      </div>

      <div className="mt-3">
        <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-500">
          Units on this receipt
        </span>
        <ul className="overflow-hidden rounded-lg border border-gray-200">
          {units.map((u) => (
            <li
              key={u.key}
              className="flex flex-wrap items-center gap-x-4 border-b border-gray-100 bg-gray-50 px-3 py-2 text-sm last:border-b-0"
            >
              <span className="font-mono text-gray-900">{u.serial}</span>
              <span className="text-gray-400">–</span>
              <span className="text-gray-700">{u.name}</span>
            </li>
          ))}
        </ul>
      </div>

      <label className="mt-4 block">
        <span className="mb-1 block text-[12px] font-medium text-gray-600">Notes</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-purple-500"
        />
      </label>

      <div className="mt-4 flex gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-purple-700 px-5 py-2 text-sm font-semibold text-white hover:bg-purple-800 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        <button
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-5 py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          <X className="h-4 w-4" /> Cancel
        </button>
      </div>
    </section>
  )
}
