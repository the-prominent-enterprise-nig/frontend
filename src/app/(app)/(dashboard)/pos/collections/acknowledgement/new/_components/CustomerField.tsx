'use client'

import { useState } from 'react'
import { SearchCombobox, type SearchComboboxOption } from '@/src/components/ui/SearchCombobox'
import { ARInvoices, AcknowledgementReceipts } from '@/src/libs/data/AccountingV2Data'

export type PickedCustomer = { id: string; name: string }

/** Search for a customer; when nobody matches, "+ Add "<typed>" as new
 * customer" opens a small inline form right under the field (not a modal)
 * that creates the customer and picks it. The search goes through the AR
 * invoices module's own customer lookup, so an Accountant without CRM access
 * can still use it. */
export default function CustomerField({
  value,
  onChange,
}: {
  value: PickedCustomer | null
  onChange: (customer: PickedCustomer | null) => void
}) {
  // SearchCombobox only learns a label by the user picking a result, so a
  // customer created inline (or reset from outside) remounts it with the
  // right label via this counter.
  const [boxKey, setBoxKey] = useState(0)
  const [adding, setAdding] = useState<{ name: string; phone: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const search = async (query: string): Promise<SearchComboboxOption[]> => {
    const q = query.trim()
    if (!q) return []
    const res = await ARInvoices.searchCustomers(q)
    return (res.data ?? []).map((c) => ({
      id: c.id,
      primary: c.name,
      secondary: [c.customerCode, c.phone].filter(Boolean).join(' · ') || undefined,
    }))
  }

  const save = async () => {
    if (!adding) return
    const name = adding.name.trim()
    if (!name) {
      setError('Name is required.')
      return
    }
    setSaving(true)
    setError(null)
    // A name is all a settlement needs; the rest of the profile can be filled
    // in later from CRM.
    const res = await AcknowledgementReceipts.createCustomer({
      name,
      phone: adding.phone.trim() || undefined,
    })
    setSaving(false)
    if (!res.success || !res.data) {
      setError(res.message || res.error || 'Could not add the customer.')
      return
    }
    onChange({ id: res.data.id, name: res.data.name })
    setBoxKey((k) => k + 1)
    setAdding(null)
  }

  return (
    <div>
      <SearchCombobox
        key={boxKey}
        value={value?.id ?? ''}
        initialLabel={value?.name}
        onChange={(id) => {
          if (!id) onChange(null)
        }}
        onSelect={(option) => onChange({ id: option.id, name: option.primary })}
        queryKey="ack-receipt-customers"
        search={search}
        placeholder="Search customer…"
        typeToSearchMessage="Type a name to search customers…"
        emptyMessage="No customer found"
        addOption={{
          label: (typed) => `+ Add "${typed}" as new customer`,
          onAdd: (typed) => {
            setError(null)
            setAdding({ name: typed, phone: '' })
          },
        }}
      />

      {adding && (
        <div className="mt-3 space-y-3 border-l-2 border-prominent-purple-200 pl-3">
          <p className="text-xs font-semibold text-prominent-purple-900">New customer</p>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-800">
              Name <span className="text-red-600">*</span>
            </span>
            <input
              value={adding.name}
              onChange={(e) => setAdding({ ...adding, name: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-800">Phone</span>
            <input
              value={adding.phone}
              onChange={(e) => setAdding({ ...adding, phone: e.target.value })}
              placeholder="Optional"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="rounded-lg bg-purple-700 px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-purple-800 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save customer'}
            </button>
            <button
              type="button"
              onClick={() => setAdding(null)}
              disabled={saving}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-[13px] font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
