'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { purchaseRequestsApi } from '@/src/libs/api/procurement'
import { ItemPicker, SupplierPicker } from '@/src/components/procurement/EntityPicker'

type LineDraft = {
  itemId: string
  quantity: string
  suggestedSupplierId: string
  notes: string
}

const emptyLine: LineDraft = {
  itemId: '',
  quantity: '',
  suggestedSupplierId: '',
  notes: '',
}

export default function NewPurchaseRequestForm({
  tenantId,
  currentUserId,
}: {
  tenantId: string
  currentUserId: string
}) {
  const router = useRouter()
  const [code, setCode] = useState(
    `PR-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, '0')}`
  )
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<LineDraft[]>([{ ...emptyLine }])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function setLine(i: number, patch: Partial<LineDraft>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const cleanLines = lines
      .filter((l) => l.itemId && l.quantity)
      .map((l) => ({
        itemId: l.itemId,
        quantity: Number(l.quantity),
        suggestedSupplierId: l.suggestedSupplierId || undefined,
        notes: l.notes || undefined,
      }))
    if (!cleanLines.length) {
      setError('Add at least one line with item ID and quantity')
      return
    }

    setSubmitting(true)
    const res = await purchaseRequestsApi.create({
      tenantId,
      code,
      requestedById: currentUserId,
      reason: reason || undefined,
      notes: notes || undefined,
      lines: cleanLines,
    })
    setSubmitting(false)
    if (res.success && res.data) {
      router.push(`/procurement/purchase-requests/${res.data.id}`)
    } else {
      setError(res.message ?? 'Failed to create')
    }
  }

  return (
    <div className="px-6 py-8 lg:px-10">
      <Link
        href="/procurement/purchase-requests"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" /> Back to requests
      </Link>

      <h1 className="text-2xl font-semibold text-gray-900">New Purchase Request</h1>

      <form
        onSubmit={onSubmit}
        className="mt-6 max-w-3xl space-y-5 rounded-xl border border-gray-200 bg-white p-6"
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[13px] font-medium text-gray-700">PR code *</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-gray-700">Reason</label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Restock low inventory"
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-[13px] font-semibold text-gray-700">Line items</label>
            <button
              type="button"
              onClick={() => setLines((ls) => [...ls, { ...emptyLine }])}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-[12px] font-medium text-gray-700 hover:bg-gray-50"
            >
              <Plus className="h-3.5 w-3.5" />
              Add line
            </button>
          </div>
          <div className="space-y-2">
            {lines.map((l, i) => (
              <div
                key={i}
                className="grid grid-cols-12 gap-2 rounded-lg border border-gray-200 bg-gray-50/50 p-2"
              >
                <div className="col-span-5">
                  <ItemPicker
                    value={l.itemId}
                    onChange={(id) => setLine(i, { itemId: id })}
                    placeholder="Pick an item *"
                    compact
                  />
                </div>
                <input
                  type="number"
                  step="any"
                  value={l.quantity}
                  onChange={(e) => setLine(i, { quantity: e.target.value })}
                  placeholder="Qty *"
                  className="col-span-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[13px]"
                />
                <div className="col-span-4">
                  <SupplierPicker
                    value={l.suggestedSupplierId}
                    onChange={(id) => setLine(i, { suggestedSupplierId: id })}
                    placeholder="Suggested supplier"
                    compact
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}
                  disabled={lines.length === 1}
                  className="col-span-1 rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-[13px] font-medium text-gray-700">Notes</label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
          />
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="flex items-center justify-end gap-3">
          <Link
            href="/procurement/purchase-requests"
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-prominent-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-prominent-orange-700 disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : 'Submit PR'}
          </button>
        </div>
      </form>
    </div>
  )
}
