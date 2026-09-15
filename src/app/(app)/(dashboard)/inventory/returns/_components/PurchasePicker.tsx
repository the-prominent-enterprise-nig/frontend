'use client'

import { useMemo, useState } from 'react'
import { Search, FileText, Hash, Check, Loader2, PackageSearch, ReceiptText } from 'lucide-react'
import type { CustomerPurchase } from '@/src/schema/inventory/returns'

type Props = {
  purchases: CustomerPurchase[]
  isLoading: boolean
  selectedId: string
  onSelect: (purchaseId: string) => void
}

const peso = (value: number): string =>
  value.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })

const soldOn = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })

/** Everything the clerk needs to recognise the unit in front of them, on one
 *  line each: what it is, which unit, and the invoice it sold on. The invoice
 *  rides along with the item rather than sitting in its own field, because the
 *  clerk is matching a thing on the counter to a line on a receipt — not
 *  filling two independent lookups and hoping they agree. */
function matches(purchase: CustomerPurchase, query: string): boolean {
  const haystack = [
    purchase.itemName,
    purchase.itemSku,
    purchase.serialNumber,
    purchase.transactionNumber,
    purchase.salesInvoiceNumber,
    purchase.arInvoiceNumber,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return haystack.includes(query.trim().toLowerCase())
}

export default function PurchasePicker({
  purchases,
  isLoading,
  selectedId,
  onSelect,
}: Props): React.ReactElement {
  const [query, setQuery] = useState('')

  const visible = useMemo(
    () => (query.trim() ? purchases.filter((p) => matches(p, query)) : purchases),
    [purchases, query]
  )

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-6 text-sm text-zinc-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading their purchases…
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-zinc-200">
      {purchases.length > 4 && (
        <div className="relative border-b border-zinc-200">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by item, serial, SI # or invoice…"
            className="w-full rounded-t-xl bg-white py-2.5 pr-3 pl-9 text-sm outline-none placeholder:text-zinc-400"
          />
        </div>
      )}

      <div className="max-h-72 divide-y divide-zinc-100 overflow-y-auto">
        {visible.map((purchase) => (
          <PurchaseRow
            key={purchase.id}
            purchase={purchase}
            isSelected={purchase.id === selectedId}
            onSelect={onSelect}
          />
        ))}

        {visible.length === 0 && (
          <div className="flex flex-col items-center gap-1 px-4 py-8 text-center">
            <PackageSearch className="h-5 w-5 text-zinc-300" />
            <p className="text-sm text-zinc-500">Nothing matches “{query}”.</p>
          </div>
        )}
      </div>
    </div>
  )
}

/** One purchased line, presented as the whole answer: picking it settles the
 *  item, the unit, the quantity and the invoice in a single click. */
function PurchaseRow({
  purchase,
  isSelected,
  onSelect,
}: {
  purchase: CustomerPurchase
  isSelected: boolean
  onSelect: (id: string) => void
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={() => onSelect(purchase.id)}
      aria-pressed={isSelected}
      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors ${
        isSelected ? 'bg-prominent-purple-50' : 'hover:bg-zinc-50'
      }`}
    >
      <span
        className={`mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border ${
          isSelected
            ? 'border-prominent-purple-700 bg-prominent-purple-700'
            : 'border-zinc-300 bg-white'
        }`}
      >
        {isSelected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="truncate text-sm font-medium text-zinc-900">
            {purchase.itemName ?? purchase.itemSku ?? 'Item'}
          </span>
          {purchase.itemSku && (
            <span className="font-mono text-xs text-zinc-400">{purchase.itemSku}</span>
          )}
        </span>

        <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {/* The SI leads: it is the number printed on the receipt in the
              customer's hand, so it is what the clerk is matching this row
              against. The AR invoice behind it matters to accounting, not to
              the person at the counter. */}
          {purchase.salesInvoiceNumber && (
            <span className="inline-flex items-center gap-1 rounded-md bg-prominent-purple-50 px-1.5 py-0.5 font-mono text-[11px] font-medium text-prominent-purple-700">
              <ReceiptText className="h-3 w-3" />
              {purchase.salesInvoiceNumber}
            </span>
          )}
          <InvoiceTag purchase={purchase} />
          {purchase.serialNumber && (
            <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] text-zinc-600">
              <Hash className="h-3 w-3" />
              {purchase.serialNumber}
            </span>
          )}
        </span>

        <span className="mt-1.5 block text-xs text-zinc-500">
          Qty {purchase.quantity} · {peso(purchase.unitPrice)} each · sold{' '}
          {soldOn(purchase.occurredAt)} on {purchase.transactionNumber}
        </span>
      </span>
    </button>
  )
}

/** A cash sale has nothing to credit, and saying so here — on the line the
 *  clerk is choosing — is what stops them hunting for an invoice number that
 *  was never issued. */
function InvoiceTag({ purchase }: { purchase: CustomerPurchase }): React.ReactElement {
  if (!purchase.arInvoiceId) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-500">
        Cash sale — no invoice
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-prominent-orange-50 px-1.5 py-0.5 text-[11px] font-medium text-prominent-orange-800">
      <FileText className="h-3 w-3" />
      {purchase.arInvoiceNumber ?? 'Invoice attached'}
    </span>
  )
}
