'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { TaxCodes } from '@/src/libs/data/AccountingV2Data'
import { STALE } from '@/src/libs/query/stale-times'
import { outputVatChoices, type OutputVatOption } from '@/src/libs/tax/output-vat'

/**
 * The output VAT classes a sale or an invoice can take — the tax code
 * master's active OUTPUT_VAT codes, narrowed to the ones this document allows,
 * with the rate each is in force at today. Falls back to the seeded three
 * while the list loads (or if it cannot be read), so a picker never blanks.
 */
export function useOutputVatCodes(allowed: readonly string[]) {
  const query = useQuery({
    queryKey: ['tax-codes', 'options', 'OUTPUT_VAT'],
    queryFn: async () => {
      const res = await TaxCodes.options('OUTPUT_VAT')
      if (!res.success || !res.data) {
        throw new Error(res.message || 'Could not load the output VAT codes')
      }
      return res.data
    },
    staleTime: STALE.LOOKUP,
  })
  const options: OutputVatOption[] = useMemo(
    () => outputVatChoices(query.data, allowed),
    [query.data, allowed]
  )
  return { options, isLoading: query.isLoading, error: query.error as Error | null }
}
