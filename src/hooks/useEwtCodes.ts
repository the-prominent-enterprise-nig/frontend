'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { TaxCodes } from '@/src/libs/data/AccountingV2Data'
import { STALE } from '@/src/libs/query/stale-times'
import { ewtRateFor } from '@/src/libs/tax/ewt'

/**
 * The EWT codes a supplier, a bill or a receiving line can be withheld at —
 * the tax code master's active EWT codes, with the rate each is in force at
 * today. `rateFor` is what the preview totals multiply by; it falls back to
 * the workbook's rates until the list arrives, so a totals panel never blanks.
 */
export function useEwtCodes() {
  const query = useQuery({
    queryKey: ['tax-codes', 'options', 'EWT_PAYABLE'],
    queryFn: async () => {
      const res = await TaxCodes.options('EWT_PAYABLE')
      if (!res.success || !res.data) {
        throw new Error(res.message || 'Could not load the withholding tax codes')
      }
      return res.data
    },
    staleTime: STALE.LOOKUP,
  })
  const options = useMemo(() => query.data ?? [], [query.data])
  const rateFor = useMemo(() => ewtRateFor(query.data), [query.data])
  return {
    options,
    rateFor,
    isLoading: query.isLoading,
    error: query.error as Error | null,
  }
}
