import { useEffect, useState } from 'react'
import {
  AccountMappings,
  type TaxBaseRule,
  type TaxCodeType,
} from '@/src/libs/data/AccountingV2Data'

export const TAX_CODE_TYPES: TaxCodeType[] = [
  'OUTPUT_VAT',
  'INPUT_VAT',
  'EWT_PAYABLE',
  'CWT_RECEIVABLE',
  'WTC',
  'OTHER',
]

export const TAX_CODE_TYPE_LABELS: Record<TaxCodeType, string> = {
  OUTPUT_VAT: 'Output VAT',
  INPUT_VAT: 'Input VAT',
  EWT_PAYABLE: 'Withholding tax payable (EWT)',
  CWT_RECEIVABLE: 'Creditable withholding tax (CWT)',
  WTC: 'Withholding tax on compensation',
  OTHER: 'Other',
}

export const TAX_BASE_RULES: TaxBaseRule[] = [
  'GROSS',
  'VAT_EXCLUSIVE',
  'VAT_INCLUSIVE_EXTRACT',
  'NET_OF_VAT',
  'FIXED',
  'VARIABLE',
]

export const TAX_BASE_RULE_LABELS: Record<TaxBaseRule, string> = {
  GROSS: 'Gross amount',
  VAT_EXCLUSIVE: 'VAT-exclusive amount',
  VAT_INCLUSIVE_EXTRACT: 'VAT extracted from a VAT-inclusive amount',
  NET_OF_VAT: 'Amount net of VAT',
  FIXED: 'Fixed amount',
  VARIABLE: 'Set where it is used',
}

/**
 * Which posting keys (AccountMapping keys) a code of each type may post to.
 * Mirrors MAPPING_KEYS_BY_TAX_TYPE in the backend's
 * accounting/tax-codes/tax-code.constants.ts, which is what actually enforces
 * it — this only keeps the dropdown from offering a choice that would be
 * refused. 'ANY' (Other) offers every key.
 */
export const POSTING_KEYS_BY_TAX_TYPE: Record<TaxCodeType, string[] | 'ANY'> = {
  OUTPUT_VAT: ['OUTPUT_VAT', 'VAT_PAYABLE'],
  INPUT_VAT: ['INPUT_VAT'],
  EWT_PAYABLE: ['WHT_PAYABLE', 'WHT_PAYABLE_RENT', 'WHT_PAYABLE_PROFESSIONAL'],
  CWT_RECEIVABLE: ['WHT_RECEIVABLE'],
  WTC: [],
  OTHER: 'ANY',
}

/** "12%", "1%", "0.5%" — and what a rate means when it is not fixed. */
export function fmtRate(ratePercent: number, baseRule: TaxBaseRule): string {
  const n = String(Number(ratePercent.toFixed(4)))
  if (baseRule === 'VARIABLE') return ratePercent > 0 ? `${n}% (varies)` : 'Set per use'
  return `${n}%`
}

/** AccountMapping key -> its human label ("Withholding Tax Payable — Rent"),
 * so a code reads as the account it posts to rather than as a code constant.
 * `ready` turns true once the lookup has finished — successfully or not — so a
 * screen can leave the cell blank meanwhile instead of flashing the raw key.
 * For a user who cannot read mappings the map stays empty and callers fall back
 * to the raw key. */
export function usePostingKeyLabels(): { labels: Map<string, string>; ready: boolean } {
  const [state, setState] = useState<{ labels: Map<string, string>; ready: boolean }>({
    labels: new Map(),
    ready: false,
  })
  useEffect(() => {
    let cancelled = false
    AccountMappings.list().then((res) => {
      if (cancelled) return
      setState({
        labels: new Map(res.success && res.data ? res.data.map((m) => [m.key, m.label]) : []),
        ready: true,
      })
    })
    return () => {
      cancelled = true
    }
  }, [])
  return state
}
