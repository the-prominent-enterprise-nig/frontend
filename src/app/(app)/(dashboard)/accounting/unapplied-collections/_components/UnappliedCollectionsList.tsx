'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Plus, RefreshCw, X, ArrowRightLeft, Undo2 } from 'lucide-react'
import {
  UnappliedCollections,
  ARInvoices,
  type UnappliedCustomerCollection,
  type ARInvoiceCustomerResult,
  type ARInvoice,
  fmtMoney,
  fmtDate,
} from '@/src/libs/data/AccountingV2Data'

const STATUS_STYLES: Record<string, string> = {
  UNMATCHED: 'bg-amber-50 text-amber-700',
  APPLIED: 'bg-emerald-50 text-emerald-700',
  REFUNDED: 'bg-gray-100 text-gray-500',
}

export default function UnappliedCollectionsList() {
  const [items, setItems] = useState<UnappliedCustomerCollection[]>([])
  const [loading, setLoading] = useState(true)
  const [recording, setRecording] = useState(false)
  const [applying, setApplying] = useState<UnappliedCustomerCollection | null>(null)
  const [refunding, setRefunding] = useState<UnappliedCustomerCollection | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await UnappliedCollections.list()
    setItems(res.data ?? [])
    setLoading(false)
  }, [])
  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Unapplied Collections</h2>
          <p className="text-sm text-gray-500">
            Payments collected from a known customer whose invoice isn&rsquo;t decided yet.
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
            onClick={() => setRecording(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-purple-700 text-white rounded-lg hover:bg-purple-800"
          >
            <Plus className="w-4 h-4" /> Record Collection
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left">Customer</th>
              <th className="px-3 py-2 text-left">Collected</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2 text-right">Unapplied</th>
              <th className="px-3 py-2 text-left">Reference</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-gray-400">
                  Loading...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-gray-400">
                  No unapplied collections.
                </td>
              </tr>
            ) : (
              items.map((c) => (
                <tr key={c.id}>
                  <td className="px-3 py-2">{c.customer?.name ?? '—'}</td>
                  <td className="px-3 py-2 text-xs">{fmtDate(c.createdAt)}</td>
                  <td className="px-3 py-2 text-right">{fmtMoney(c.amount)}</td>
                  <td className="px-3 py-2 text-right">{fmtMoney(c.unappliedAmount)}</td>
                  <td className="px-3 py-2 text-xs">{c.reference || '—'}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs ${STATUS_STYLES[c.status] ?? 'bg-gray-100 text-gray-600'}`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {c.status === 'UNMATCHED' && (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setApplying(c)}
                          className="flex items-center gap-1 px-2 py-1 text-xs text-purple-700 hover:bg-purple-50 border border-purple-200 rounded"
                        >
                          <ArrowRightLeft className="w-3 h-3" /> Apply
                        </button>
                        <button
                          onClick={() => setRefunding(c)}
                          className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 border border-gray-200 rounded"
                        >
                          <Undo2 className="w-3 h-3" /> Refund
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {recording && (
        <RecordForm
          onClose={() => setRecording(false)}
          onSaved={() => {
            setRecording(false)
            load()
          }}
        />
      )}
      {applying && (
        <ApplyForm
          collection={applying}
          onClose={() => setApplying(null)}
          onSaved={() => {
            setApplying(null)
            load()
          }}
        />
      )}
      {refunding && (
        <RefundForm
          collection={refunding}
          onClose={() => setRefunding(null)}
          onSaved={() => {
            setRefunding(null)
            load()
          }}
        />
      )}
    </div>
  )
}

function RecordForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [search, setSearch] = useState('')
  const [customers, setCustomers] = useState<ARInvoiceCustomerResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<ARInvoiceCustomerResult | null>(null)
  const [amount, setAmount] = useState('')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!search.trim() || selectedCustomer) {
      setCustomers([])
      return
    }
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(async () => {
      setSearching(true)
      const res = await ARInvoices.searchCustomers(search.trim())
      setCustomers(res.data ?? [])
      setSearching(false)
    }, 300)
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current)
    }
  }, [search, selectedCustomer])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCustomer) return
    setSaving(true)
    setError(null)
    const res = await UnappliedCollections.record({
      customerId: selectedCustomer.id,
      amount: Number(amount),
      reference: reference || undefined,
      notes: notes || undefined,
    })
    setSaving(false)
    if (!res.success) {
      setError(res.message || res.error || 'Failed — check Account Mapping settings')
      return
    }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="text-lg font-semibold">Record Unapplied Collection</h3>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <p className="text-xs text-gray-500">
            For a payment from a known customer whose invoice isn&rsquo;t decided yet. Auto-posts to
            the General Ledger.
          </p>
          <label className="block">
            <span className="block text-xs font-medium text-gray-600 mb-1">Customer *</span>
            {selectedCustomer ? (
              <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                <span className="text-sm font-medium text-gray-800">{selectedCustomer.name}</span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCustomer(null)
                    setSearch('')
                  }}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  Change
                </button>
              </div>
            ) : (
              <>
                <input
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
                  placeholder="Search by name or phone…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {searching && <p className="text-xs text-gray-400 mt-1">Searching…</p>}
                {customers.length > 0 && (
                  <div className="mt-1 overflow-hidden rounded-lg border border-gray-200 bg-white max-h-40 overflow-y-auto">
                    {customers.map((c) => (
                      <button
                        type="button"
                        key={c.id}
                        onClick={() => setSelectedCustomer(c)}
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-gray-600 mb-1">Amount *</span>
            <input
              required
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-gray-600 mb-1">
              OR / Reference Number
            </span>
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-gray-600 mb-1">
              Why the invoice isn&rsquo;t known yet
            </span>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
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
              disabled={saving || !selectedCustomer || !amount}
              className="px-4 py-2 text-sm font-semibold bg-purple-700 text-white rounded-lg disabled:opacity-50"
            >
              {saving ? 'Posting...' : 'Post to GL'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ApplyForm({
  collection,
  onClose,
  onSaved,
}: {
  collection: UnappliedCustomerCollection
  onClose: () => void
  onSaved: () => void
}) {
  const [invoices, setInvoices] = useState<ARInvoice[]>([])
  const [loadingInvoices, setLoadingInvoices] = useState(true)
  const [invoiceId, setInvoiceId] = useState('')
  const [amount, setAmount] = useState(String(collection.unappliedAmount))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ARInvoices.list({ customerId: collection.customerId }).then((res) => {
      const open = (res.data?.items ?? []).filter((i) => i.amountPaid < i.totalAmount)
      setInvoices(open)
      setLoadingInvoices(false)
    })
  }, [collection.customerId])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!invoiceId) return
    setSaving(true)
    setError(null)
    const res = await UnappliedCollections.apply(collection.id, {
      arInvoiceId: invoiceId,
      amount: Number(amount),
    })
    setSaving(false)
    if (!res.success) {
      setError(res.message || res.error || 'Failed to apply')
      return
    }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="text-lg font-semibold">Apply Collection</h3>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <p className="text-xs text-gray-500">
            {fmtMoney(collection.unappliedAmount)} unapplied from {collection.customer?.name}. Now
            identified as belonging to:
          </p>
          <label className="block">
            <span className="block text-xs font-medium text-gray-600 mb-1">Invoice *</span>
            {loadingInvoices ? (
              <p className="text-xs text-gray-400">Loading open invoices…</p>
            ) : invoices.length === 0 ? (
              <p className="text-xs text-amber-600">
                This customer has no open (unpaid) invoices to apply against.
              </p>
            ) : (
              <select
                required
                value={invoiceId}
                onChange={(e) => setInvoiceId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              >
                <option value="">— Select —</option>
                {invoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.invoiceNumber} — {fmtMoney(inv.totalAmount - inv.amountPaid)} open
                  </option>
                ))}
              </select>
            )}
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-gray-600 mb-1">Amount to Apply *</span>
            <input
              required
              type="number"
              step="0.01"
              max={collection.unappliedAmount}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
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
              disabled={saving || !invoiceId}
              className="px-4 py-2 text-sm font-semibold bg-purple-700 text-white rounded-lg disabled:opacity-50"
            >
              {saving ? 'Applying...' : 'Apply'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function RefundForm({
  collection,
  onClose,
  onSaved,
}: {
  collection: UnappliedCustomerCollection
  onClose: () => void
  onSaved: () => void
}) {
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const res = await UnappliedCollections.refund(collection.id, { reason: reason || undefined })
    setSaving(false)
    if (!res.success) {
      setError(res.message || res.error || 'Failed to refund')
      return
    }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="text-lg font-semibold">Refund Collection</h3>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <p className="text-xs text-gray-500">
            Refund {fmtMoney(collection.unappliedAmount)} to {collection.customer?.name}.
          </p>
          <label className="block">
            <span className="block text-xs font-medium text-gray-600 mb-1">Reason</span>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
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
              className="px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-lg disabled:opacity-50"
            >
              {saving ? 'Refunding...' : 'Refund'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
