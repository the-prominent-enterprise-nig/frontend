'use client'

import { useState } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import {
  createQuotation,
  type Quotation,
  type SalesLineInput,
} from '@/src/libs/actions/sales.actions'

type LineItem = {
  itemName: string
  description: string
  quantity: string
  unitPrice: string
  taxRate: string
}

function emptyLine(): LineItem {
  return { itemName: '', description: '', quantity: '1', unitPrice: '0', taxRate: '0' }
}

function lineTotal(line: LineItem): number {
  const qty = parseFloat(line.quantity) || 0
  const price = parseFloat(line.unitPrice) || 0
  const tax = parseFloat(line.taxRate) || 0
  const subtotal = qty * price
  return subtotal + subtotal * (tax / 100)
}

type Props = {
  isOpen: boolean
  onClose: () => void
  onSuccess: (q: Quotation) => void
}

export default function CreateQuotationModal({ isOpen, onClose, onSuccess }: Props) {
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [issueDate, setIssueDate] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<LineItem[]>([emptyLine()])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  function updateLine(index: number, field: keyof LineItem, value: string) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, [field]: value } : l)))
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()])
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index))
  }

  function reset() {
    setCustomerName('')
    setCustomerEmail('')
    setCustomerPhone('')
    setIssueDate('')
    setExpiryDate('')
    setNotes('')
    setLines([emptyLine()])
    setError(null)
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!customerName.trim()) {
      setError('Customer name is required.')
      return
    }
    if (!issueDate) {
      setError('Issue date is required.')
      return
    }
    if (lines.length === 0) {
      setError('Add at least one line item.')
      return
    }
    for (const l of lines) {
      if (!l.itemName.trim()) {
        setError('All line items must have an item name.')
        return
      }
    }

    const lineInputs: SalesLineInput[] = lines.map((l, i) => ({
      itemName: l.itemName.trim(),
      description: l.description.trim() || undefined,
      quantity: parseFloat(l.quantity) || 1,
      unitPrice: parseFloat(l.unitPrice) || 0,
      taxRate: parseFloat(l.taxRate) || 0,
      sortOrder: i,
    }))

    setSubmitting(true)
    try {
      const result = await createQuotation({
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        issueDate,
        expiryDate: expiryDate || undefined,
        notes: notes.trim() || undefined,
        lines: lineInputs,
      })

      if (!result.success) {
        setError(result.error ?? 'Failed to create quotation.')
        return
      }

      if (result.data) {
        reset()
        onSuccess(result.data)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const grandTotal = lines.reduce((sum, l) => sum + lineTotal(l), 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">New Quotation</h2>
            <p className="mt-0.5 text-sm text-zinc-500">Create a quotation for a customer.</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="max-h-[72vh] overflow-y-auto px-6 py-5 space-y-5">
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

          {/* Customer info */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-3">
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Customer Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Acme Corp"
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Customer Email</label>
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="contact@acme.com"
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Customer Phone</label>
              <input
                type="text"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="+63 917 000 0000"
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Issue Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Expiry Date</label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Optional notes..."
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400 resize-none"
            />
          </div>

          {/* Line items */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-zinc-700">Line Items</label>
              <button
                type="button"
                onClick={addLine}
                className="flex items-center gap-1 rounded-lg bg-zinc-100 px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-200 transition"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Line
              </button>
            </div>

            <div className="overflow-hidden rounded-lg border border-zinc-200">
              <table className="min-w-full">
                <thead className="bg-zinc-50">
                  <tr>
                    {['Item Name', 'Qty', 'Unit Price', 'Tax %', 'Total', ''].map((h) => (
                      <th
                        key={h}
                        className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {lines.map((line, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={line.itemName}
                          onChange={(e) => updateLine(i, 'itemName', e.target.value)}
                          placeholder="Item name"
                          className="w-full rounded border border-zinc-200 px-2 py-1 text-sm outline-none focus:border-zinc-400"
                        />
                      </td>
                      <td className="px-3 py-2 w-20">
                        <input
                          type="number"
                          min="0"
                          value={line.quantity}
                          onChange={(e) => updateLine(i, 'quantity', e.target.value)}
                          className="w-full rounded border border-zinc-200 px-2 py-1 text-sm outline-none focus:border-zinc-400"
                        />
                      </td>
                      <td className="px-3 py-2 w-28">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.unitPrice}
                          onChange={(e) => updateLine(i, 'unitPrice', e.target.value)}
                          className="w-full rounded border border-zinc-200 px-2 py-1 text-sm outline-none focus:border-zinc-400"
                        />
                      </td>
                      <td className="px-3 py-2 w-20">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={line.taxRate}
                          onChange={(e) => updateLine(i, 'taxRate', e.target.value)}
                          className="w-full rounded border border-zinc-200 px-2 py-1 text-sm outline-none focus:border-zinc-400"
                        />
                      </td>
                      <td className="px-3 py-2 w-28 text-right text-sm font-medium text-zinc-700">
                        {lineTotal(line).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-2 w-10">
                        {lines.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeLine(i)}
                            className="rounded p-1 text-red-400 hover:bg-red-50 transition"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-2 flex justify-end">
              <p className="text-sm font-semibold text-zinc-800">
                Total: {grandTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-zinc-200 px-6 py-4">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="create-quotation-form"
            disabled={submitting}
            onClick={(e) => {
              e.preventDefault()
              void handleSubmit(e)
            }}
            className="rounded-lg bg-prominent-purple-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-prominent-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Creating...' : 'Create Quotation'}
          </button>
        </div>
      </div>
    </div>
  )
}
