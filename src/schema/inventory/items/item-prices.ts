import { z } from 'zod'
import type { ItemPriceGuideEntry } from '../price-lists'

export const PRICE_TERM_MONTHS = [3, 6, 9, 12] as const
export type PriceTermMonths = (typeof PRICE_TERM_MONTHS)[number]

const TermCellsSchema = z.object({
  mi: z.number().min(0).optional(),
  ppd: z.number().min(0).optional(),
})

/** One price use's line for an item — the same cells as a row of the price
 * list upload (PRICE, DOWN PAYMENT, 3–12mos MI/PPD, CREDIT, CM). */
export const ItemPriceEntrySchema = z
  .object({
    priceUse: z.string().min(1, 'Price use is required'),
    price: z.number().min(0).optional(),
    downPayment: z.number().min(0).optional(),
    credit: z.number().min(0).optional(),
    cm: z.number().min(0).optional(),
    terms: z.object({
      t3: TermCellsSchema,
      t6: TermCellsSchema,
      t9: TermCellsSchema,
      t12: TermCellsSchema,
    }),
  })
  .superRefine((entry, ctx) => {
    if (entry.price === undefined) {
      ctx.addIssue({ code: 'custom', path: ['price'], message: 'Price is required' })
    }
    for (const months of PRICE_TERM_MONTHS) {
      const { mi, ppd } = entry.terms[`t${months}`]
      if ((mi === undefined) !== (ppd === undefined)) {
        ctx.addIssue({
          code: 'custom',
          path: ['terms', `t${months}`],
          message: `${months}mos needs both MI and PPD, or neither`,
        })
      }
    }
  })

export type ItemPriceEntry = z.infer<typeof ItemPriceEntrySchema>

export function emptyItemPriceEntry(): ItemPriceEntry {
  const blank = { mi: undefined, ppd: undefined }
  return {
    priceUse: '',
    price: undefined,
    downPayment: undefined,
    credit: undefined,
    cm: undefined,
    terms: { t3: { ...blank }, t6: { ...blank }, t9: { ...blank }, t12: { ...blank } },
  }
}

/** The body POST /inventory/items/:id/prices takes for one entry. */
export type ItemPricePayload = {
  priceUse: string
  price: number
  downPayment?: number
  credit?: number
  cm?: number
  terms: { termMonths: PriceTermMonths; monthlyInstallment: number; ppd: number }[]
}

export function toItemPricePayload(entry: ItemPriceEntry): ItemPricePayload {
  return {
    priceUse: entry.priceUse,
    price: entry.price ?? 0,
    downPayment: entry.downPayment,
    credit: entry.credit,
    cm: entry.cm,
    terms: PRICE_TERM_MONTHS.flatMap((months) => {
      const { mi, ppd } = entry.terms[`t${months}`]
      return mi === undefined || ppd === undefined
        ? []
        : [{ termMonths: months, monthlyInstallment: mi, ppd }]
    }),
  }
}

function toOptionalNumber(value: string | number | null | undefined): number | undefined {
  return value === null || value === undefined || value === '' ? undefined : Number(value)
}

/** An item's current price on one list, as the Edit Item form's price entry. */
export function fromPriceGuideEntry(entry: ItemPriceGuideEntry): ItemPriceEntry {
  const base = emptyItemPriceEntry()
  for (const term of entry.terms) {
    const key = `t${term.termMonths}` as `t${PriceTermMonths}`
    if (!(key in base.terms)) continue
    base.terms[key] = {
      mi: toOptionalNumber(term.monthlyInstallment),
      ppd: toOptionalNumber(term.ppd),
    }
  }
  return {
    ...base,
    priceUse: entry.priceUseType.name,
    price: toOptionalNumber(entry.price),
    downPayment: toOptionalNumber(entry.downPayment),
    credit: toOptionalNumber(entry.creditAmount),
    cm: toOptionalNumber(entry.cmAmount),
  }
}

/** Entries that are new or differ from what the item already had — resaving
 * an unchanged price would send a live list back to pending approval. */
export function changedPriceEntries(
  current: ItemPriceEntry[],
  original: ItemPriceEntry[]
): ItemPriceEntry[] {
  const before = new Map(original.map((e) => [e.priceUse, JSON.stringify(toItemPricePayload(e))]))
  return current.filter((e) => before.get(e.priceUse) !== JSON.stringify(toItemPricePayload(e)))
}
