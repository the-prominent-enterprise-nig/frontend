'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import SearchableSelect from '@/src/components/ui/SearchableSelect'
import { showToast } from '@/src/components/ui/toast'
import type { QuotaEntry } from './quota-grid'
import { getSalesQuotas, saveSalesQuotas } from '../_actions/sales-quotas'
import QuotaGrid from './QuotaGrid'

/**
 * Scenario 85 Part 4 — Sales Quotas: the monthly sales target for each branch
 * and for the AC Unit + Services line, which the Sales Reports' Branch
 * Scorecard and Daily Sales Monitoring measure Ach Rate and BTS against.
 */

function yearOptions(now = new Date().getFullYear()): { value: string; label: string }[] {
  return [now - 2, now - 1, now, now + 1].map((y) => ({ value: String(y), label: String(y) }))
}

export default function SalesQuotasView(): React.JSX.Element {
  const [year, setYear] = useState(new Date().getFullYear())
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['pos-sales-quotas', year],
    queryFn: async () => {
      const res = await getSalesQuotas(year)
      if (!res.success || !res.data) throw new Error(res.message ?? 'Could not load quotas')
      return res.data
    },
  })

  async function save(entries: QuotaEntry[]): Promise<boolean> {
    const res = await saveSalesQuotas({ year, entries })
    if (!res.success || !res.data) {
      showToast({ title: 'Quotas not saved', description: res.message, status: 'error' })
      return false
    }
    showToast({ title: `${year} quotas saved`, status: 'success' })
    await queryClient.invalidateQueries({ queryKey: ['pos-sales-quotas', year] })
    return true
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Sales Quotas</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Monthly sales targets the Branch Scorecard measures against — gross sales,
            VAT-inclusive. Paste a block straight from Excel into any cell.
          </p>
        </div>
        <label className="flex w-32 flex-col gap-1 text-xs text-zinc-600">
          Year
          <SearchableSelect
            value={String(year)}
            onChange={(v) => v && setYear(Number(v))}
            options={yearOptions()}
            placeholder="Year"
            ariaLabel="Year"
            portal
          />
        </label>
      </header>

      {query.isLoading && (
        <p className="rounded-xl border border-zinc-200 bg-white px-4 py-12 text-center text-sm text-zinc-500">
          Loading…
        </p>
      )}
      {query.isError && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Could not load the {year} quotas. Try again.
        </p>
      )}
      {query.data && (
        <QuotaGrid key={`${year}-${query.dataUpdatedAt}`} data={query.data} onSave={save} />
      )}
    </div>
  )
}
