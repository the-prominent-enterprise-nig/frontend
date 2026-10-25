'use client'

import { useState } from 'react'
import { SearchCombobox, type SearchComboboxOption } from '@/src/components/ui/SearchCombobox'
import { ARInvoices, fmtMoney } from '@/src/libs/data/AccountingV2Data'
import type { PickedCustomer } from './CustomerField'

/** `id` is null when the number was typed rather than picked from the
 * search — it is then kept as free text. */
export type PickedInvoice = { id: string | null; number: string }

/** Search the customer's sales invoices; when the number isn't there,
 * "+ Use "<typed>" as the invoice number" keeps it as typed. Either way the
 * invoice is a reference on the receipt only — nothing is created and the
 * invoice's balance does not change. */
export default function InvoiceField({
  customer,
  value,
  onChange,
}: {
  customer: PickedCustomer | null
  value: PickedInvoice | null
  onChange: (invoice: PickedInvoice | null) => void
}) {
  // Remounts the box after a typed number is kept, so it shows that text.
  const [boxKey, setBoxKey] = useState(0)

  const search = async (query: string): Promise<SearchComboboxOption[]> => {
    const q = query.trim()
    // With a customer picked, an empty box lists their invoices; without one,
    // wait for something to search on rather than loading every invoice.
    if (!q && !customer) return []
    const res = await ARInvoices.list({
      search: q || undefined,
      customerId: customer?.id,
      limit: 20,
    })
    return (res.data?.items ?? []).map((i) => ({
      id: i.id,
      primary: i.invoiceNumber,
      secondary:
        [i.customer?.name, `${fmtMoney(i.totalAmount - i.amountPaid)} open`]
          .filter(Boolean)
          .join(' · ') || undefined,
    }))
  }

  return (
    <div>
      <SearchCombobox
        key={boxKey}
        value={value?.id ?? ''}
        initialLabel={value?.number}
        onChange={(id) => {
          if (!id) onChange(null)
        }}
        onSelect={(option) => onChange({ id: option.id, number: option.primary })}
        queryKey={`ack-receipt-invoices-${customer?.id ?? 'any'}`}
        search={search}
        placeholder="Search invoice…"
        typeToSearchMessage={
          customer ? 'No invoices to list yet — type to search…' : 'Type an invoice number…'
        }
        emptyMessage="No invoice found"
        addOption={{
          label: (typed) => `+ Use "${typed}" as the invoice number`,
          onAdd: (typed) => {
            onChange({ id: null, number: typed })
            setBoxKey((k) => k + 1)
          },
        }}
      />
      {/* A typed-in number has no id for the box's own clear button to key
          on, so it gets its own way out. */}
      {value && !value.id && (
        <button
          type="button"
          onClick={() => {
            onChange(null)
            setBoxKey((k) => k + 1)
          }}
          className="mt-1 text-xs font-medium text-prominent-purple-700 hover:underline"
        >
          Clear &ldquo;{value.number}&rdquo;
        </button>
      )}
      <p className="mt-1 text-xs text-gray-500">
        Reference only — does not change the invoice balance.
      </p>
    </div>
  )
}
