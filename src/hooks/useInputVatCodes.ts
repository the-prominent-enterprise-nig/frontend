'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { TaxCodes } from '@/src/libs/data/AccountingV2Data'
import { STALE } from '@/src/libs/query/stale-times'
import { inputVatChoices, type InputVatOption } from '@/src/libs/tax/input-vat'

/**
 * The input VAT codes a purchase line can take — the tax code master's active
 * INPUT_VAT codes with the rate each is in force at today. `rateFor` is what a
 * line's preview multiplies by. Falls back to the seeded five while the list
 * loads (or if it cannot be read), so a picker never blanks.
 */
export function useInputVatCodes() {
  const query = useQuery({
    queryKey: ['tax-codes', 'options', 'INPUT_VAT'],
    queryFn: async () => {
      const res = await TaxCodes.options('INPUT_VAT')
      if (!res.success || !res.data) {
        throw new Error(res.message || 'Could not load the input VAT codes')
      }
      return res.data
    },
    staleTime: STALE.LOOKUP,
  })
  const options: InputVatOption[] = useMemo(() => inputVatChoices(query.data), [query.data])
  const rateFor = useMemo(() => {
    const byCode = new Map(options.map((o) => [o.code, o.ratePercent]))
    return (code: string | null | undefined) => (code ? (byCode.get(code) ?? 0) : 0)
  }, [options])
  return { options, rateFor, isLoading: query.isLoading, error: query.error as Error | null }
}
