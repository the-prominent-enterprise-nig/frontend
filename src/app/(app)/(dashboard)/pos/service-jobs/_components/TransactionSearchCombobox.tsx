'use client'

import { SearchCombobox } from '@/src/components/ui/SearchCombobox'
import { getTransactions } from '../../_actions/pos-actions'

type Props = {
  value: string
  onChange: (id: string) => void
  error?: string
  initialLabel?: string
}

// Links a service job back to the POS transaction/invoice where the aircon
// + installation was originally sold (ServiceDraft.posTransactionId — the
// field existed in the schema/DTO since Closing Gap 2, but had no picker UI
// until now). Reuses the same transactionNumber search the POS Transactions
// list and AR Invoices search already cross-resolve through (Scenario 23).
export function TransactionSearchCombobox({ value, onChange, error, initialLabel }: Props) {
  return (
    <SearchCombobox
      value={value}
      onChange={onChange}
      error={error}
      initialLabel={initialLabel}
      queryKey="service-draft-transaction-search"
      placeholder="Search by transaction number…"
      typeToSearchMessage="No linked sale (optional) — type a transaction number…"
      emptyMessage="No transactions found"
      search={async (query) => {
        if (!query.trim()) return []
        const res = await getTransactions({ transactionNumber: query.trim() })
        // totalAmount is a Prisma Decimal — serializes as a string over the
        // API, not a number (same gotcha already documented in this
        // scenario's own Closing Gap 5b: calling a number-only method on it
        // directly throws, since it's a string at runtime despite the type).
        return (res.data ?? []).slice(0, 20).map((t) => ({
          id: t.id,
          primary: t.transactionNumber,
          secondary: `₱${Number(t.totalAmount).toFixed(2)} — ${new Date(t.occurredAt).toLocaleDateString()}`,
        }))
      }}
    />
  )
}
