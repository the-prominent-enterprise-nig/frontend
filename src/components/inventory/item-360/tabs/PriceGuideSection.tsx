'use client'

import { Fragment, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronUp, Loader2, Tag } from 'lucide-react'
import { getItemPriceGuide } from '@/src/app/(app)/(dashboard)/inventory/items/_actions/get-item-price-guide'
import { STALE } from '@/src/libs/query/stale-times'

function money(value: string | number | null | undefined) {
  if (value == null) return '—'
  return `₱${Number(value).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
}

export default function PriceGuideSection({ itemId }: { itemId: string }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const { data, isLoading } = useQuery({
    queryKey: ['inventory-item-360', itemId, 'price-guide'],
    queryFn: () => getItemPriceGuide(itemId),
    staleTime: STALE.OPERATIONAL,
    enabled: !!itemId,
  })

  const entries = data?.success ? (data.data ?? []) : []

  function toggle(priceListId: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(priceListId)) next.delete(priceListId)
      else next.add(priceListId)
      return next
    })
  }

  return (
    <div>
      <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400">
        <Tag className="h-3.5 w-3.5" />
        Price Guide — by Price Use
      </p>

      {isLoading ? (
        <div className="flex items-center justify-center rounded-xl border border-zinc-200 py-8 text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 py-6 text-center text-sm text-zinc-400">
          Not on any active price list yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="w-6 px-3 py-2" />
                <th className="px-3 py-2">Price Use</th>
                <th className="px-3 py-2 text-right">Price</th>
                <th className="px-3 py-2 text-right">Down Payment</th>
                <th className="px-3 py-2 text-right">Floor Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {entries.map((entry) => {
                const isOpen = expanded.has(entry.priceListId)
                const hasTerms = entry.terms.length > 0
                return (
                  <Fragment key={entry.priceListId}>
                    <tr
                      className={hasTerms ? 'cursor-pointer hover:bg-zinc-50' : undefined}
                      onClick={hasTerms ? () => toggle(entry.priceListId) : undefined}
                    >
                      <td className="px-3 py-2 text-zinc-400">
                        {hasTerms ? (
                          isOpen ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )
                        ) : null}
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-zinc-800">{entry.priceUseType.name}</div>
                        {entry.priceUseType.description && (
                          <div className="text-xs text-zinc-400">
                            {entry.priceUseType.description}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right text-zinc-800">{money(entry.price)}</td>
                      <td className="px-3 py-2 text-right text-zinc-600">
                        {money(entry.downPayment)}
                      </td>
                      <td className="px-3 py-2 text-right text-zinc-600">
                        {money(entry.floorPrice)}
                      </td>
                    </tr>
                    {isOpen && hasTerms && (
                      <tr className="bg-zinc-50/60">
                        <td colSpan={5} className="px-3 py-3">
                          <p className="mb-2 text-xs font-medium text-zinc-500">
                            Installment terms
                          </p>
                          <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
                            <table className="w-full text-xs">
                              <thead className="bg-zinc-50 text-left font-medium uppercase tracking-wide text-zinc-400">
                                <tr>
                                  <th className="px-3 py-1.5">Term</th>
                                  <th className="px-3 py-1.5 text-right">Monthly</th>
                                  <th className="px-3 py-1.5 text-right">PPD</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-zinc-100">
                                {entry.terms.map((term) => (
                                  <tr key={term.termMonths}>
                                    <td className="px-3 py-1.5 text-zinc-700">
                                      {term.termMonths} mo
                                    </td>
                                    <td className="px-3 py-1.5 text-right text-zinc-700">
                                      {money(term.monthlyInstallment)}
                                    </td>
                                    <td className="px-3 py-1.5 text-right text-zinc-500">
                                      {money(term.ppd)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
