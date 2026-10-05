'use client'

import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { Modal } from '@/src/components/ui/Modal'
import { getItemPriceGuide } from '@/src/app/(app)/(dashboard)/inventory/items/_actions/get-item-price-guide'
import type { ItemPriceGuideEntry } from '@/src/schema/inventory/price-lists'
import { STALE } from '@/src/libs/query/stale-times'
import type { PosCatalogItem } from '../_hooks/usePosCatalog'

const peso = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 2,
})

function money(value: string | number | null | undefined): string {
  if (value == null || value === '') return '—'
  return peso.format(Number(value))
}

/** The grid always shows these installment lengths, as on the Item Master
 * price breakdown; any other length in the data is added after them. */
const STANDARD_TERMS = [3, 6, 9, 12]

function termMonthsOf(entries: ItemPriceGuideEntry[]): number[] {
  const months = new Set<number>(STANDARD_TERMS)
  for (const entry of entries) for (const term of entry.terms) months.add(term.termMonths)
  return [...months].sort((a, b) => a - b)
}

function usePriceGuide(itemId: string | null) {
  return useQuery({
    queryKey: ['pos-product-catalog', 'price-guide', itemId],
    queryFn: () => getItemPriceGuide(itemId ?? ''),
    enabled: !!itemId,
    staleTime: STALE.OPERATIONAL,
  })
}

export function PriceTierModal({
  item,
  onClose,
}: {
  item: PosCatalogItem | null
  onClose: () => void
}) {
  const { data, isLoading } = usePriceGuide(item?.id ?? null)
  const entries = data?.success ? (data.data ?? []) : []
  const termMonths = termMonthsOf(entries)

  return (
    <Modal
      open={!!item}
      title={item ? `Price Tier Breakdown: ${item.name}` : ''}
      onClose={onClose}
      size="2xl"
    >
      {item && (
        <div className="space-y-5">
          <dl className="grid grid-cols-1 gap-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Description
              </dt>
              <dd className="mt-1 text-sm text-zinc-800">{item.description || item.name}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Category
              </dt>
              <dd className="mt-1 text-sm text-zinc-800">{item.category?.name ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Available Stock
              </dt>
              <dd className="mt-1 text-sm text-zinc-800">
                {item.stockQty ?? 0} {(item.stockQty ?? 0) === 1 ? 'unit' : 'units'}
              </dd>
            </div>
          </dl>

          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-zinc-400">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : entries.length === 0 ? (
            <div className="rounded-lg border border-zinc-200 py-6 text-center text-sm text-zinc-400">
              Not on any active price list yet.
            </div>
          ) : (
            <TierTable entries={entries} termMonths={termMonths} />
          )}
        </div>
      )}
    </Modal>
  )
}

function TierTable({
  entries,
  termMonths,
}: {
  entries: ItemPriceGuideEntry[]
  termMonths: number[]
}) {
  return (
    <div className="rounded-lg border border-zinc-200">
      <table className="w-full table-fixed text-xs">
        <thead className="bg-zinc-50 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="w-36 px-2 py-2">Price Use</th>
            <th className="px-2 py-2 text-right">Price</th>
            <th className="px-2 py-2 text-right">Down Payment</th>
            <th className="px-2 py-2 text-right">LCP</th>
            {termMonths.map((m) => (
              <TermHeaders key={m} months={m} />
            ))}
            <th className="px-2 py-2">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {entries.map((entry) => (
            <TierRow key={entry.priceListId} entry={entry} termMonths={termMonths} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TermHeaders({ months }: { months: number }) {
  return (
    <>
      <th className="px-2 py-1.5 text-right whitespace-nowrap">{months}mos MI</th>
      <th className="px-2 py-1.5 text-right whitespace-nowrap">{months}mos PPD</th>
    </>
  )
}

function TierRow({ entry, termMonths }: { entry: ItemPriceGuideEntry; termMonths: number[] }) {
  return (
    <tr className="hover:bg-zinc-50/60">
      <td className="px-2 py-1.5">
        <div className="font-medium text-zinc-800">{entry.priceUseType.name}</div>
        {entry.priceUseType.description && (
          <div className="text-[10px] text-zinc-400">{entry.priceUseType.description}</div>
        )}
      </td>
      <td className="px-2 py-1.5 text-right font-medium text-zinc-900">{money(entry.price)}</td>
      <td className="px-2 py-1.5 text-right text-zinc-700">{money(entry.downPayment)}</td>
      {/* LCP is not part of the price-guide data yet, so it shows a dash. */}
      <td className="px-2 py-1.5 text-right text-zinc-400">—</td>
      {termMonths.map((m) => {
        const term = entry.terms.find((t) => t.termMonths === m)
        return <TermCells key={m} monthly={term?.monthlyInstallment} ppd={term?.ppd} />
      })}
      <td className="px-2 py-1.5">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Active
        </span>
      </td>
    </tr>
  )
}

function TermCells({
  monthly,
  ppd,
}: {
  monthly: string | number | null | undefined
  ppd: string | number | null | undefined
}) {
  return (
    <>
      <td className="px-2 py-1.5 text-right text-zinc-800">{money(monthly)}</td>
      <td className="px-2 py-1.5 text-right text-zinc-500">{money(ppd)}</td>
    </>
  )
}
