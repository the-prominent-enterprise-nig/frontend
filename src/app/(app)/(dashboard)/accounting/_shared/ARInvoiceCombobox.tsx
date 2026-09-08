'use client'

import { SearchCombobox, type SearchComboboxOption } from '@/src/components/ui/SearchCombobox'
import { ARInvoices, fmtMoney, type ARInvoice } from '@/src/libs/data/AccountingV2Data'

const outstandingOf = (i: ARInvoice): number => i.totalAmount - i.amountPaid

type Props = {
  value: string
  /** Hands back the whole invoice: the dialogs need its totals for their
   * running summary, and a credit memo caps itself at its outstanding. */
  onChange: (invoice: ARInvoice | null) => void
  /** Credit memos are capped at what is still outstanding, so an invoice with
   * nothing left to credit cannot take one. A debit memo adds to the invoice,
   * so it has no such requirement. */
  requireOutstanding?: boolean
  error?: string
}

/**
 * Picks the invoice a customer memo is raised against, inside the memo form.
 *
 * This used to be a modal shown before the form — the invoice was chosen, and
 * only then did anyone see what they were filling in. It is a field now, so
 * the choice can be changed without starting over.
 */
export default function ARInvoiceCombobox({
  value,
  onChange,
  requireOutstanding = false,
  error,
}: Props) {
  async function search(query: string): Promise<SearchComboboxOption[]> {
    const res = await ARInvoices.list({ ...(query && { search: query }) })
    return (
      (res.data?.items ?? [])
        // A draft invoice has not been issued to the customer, so there is
        // nothing to credit or add to yet.
        .filter((i) => i.status !== 'DRAFT' && (!requireOutstanding || outstandingOf(i) > 0))
        .map((invoice) => ({
          id: invoice.id,
          primary: `${invoice.invoiceNumber} — ${invoice.customer?.name ?? 'No customer'}`,
          secondary: `${fmtMoney(invoice.totalAmount)} total · ${fmtMoney(outstandingOf(invoice))} outstanding`,
          meta: invoice,
        }))
    )
  }

  return (
    <SearchCombobox
      value={value}
      queryKey={`ar-invoice-memo-picker-${requireOutstanding ? 'outstanding' : 'any'}`}
      search={search}
      onChange={(id) => {
        // Fires on clear as well as on pick; onSelect covers the pick, so the
        // only thing left to report here is the clear.
        if (!id) onChange(null)
      }}
      onSelect={(option) => onChange(option.meta as ARInvoice)}
      placeholder="Search invoice number or customer…"
      emptyMessage={
        requireOutstanding
          ? 'No issued invoice with an outstanding balance.'
          : 'No issued invoice found.'
      }
      error={error}
    />
  )
}
