import { z } from 'zod'

/**
 * Price Maker — the installment price preview that used to be CRM's Installment
 * Accounts "Price checker". Mirrors the backend's PriceMakerDto and the result of
 * InstallmentAccountService.priceCheck: Amount Financed, the monthly
 * installment, PNV, Total Price, Interest Differential and PPD, worked out
 * without creating an account.
 */
export const priceMakerSchema = z.object({
  listedCashPrice: z.coerce.number().min(0, 'Listed cash price must be 0 or more'),
  downPayment: z.coerce.number().min(0, 'Down payment must be 0 or more'),
  termMonths: z.coerce
    .number()
    .int()
    .min(1, 'Term must be at least 1 month')
    .max(12, 'Term cannot exceed 12 months'),
  miFactor: z.coerce.number().min(0, 'MI factor must be 0 or more'),
})

export type PriceMakerInput = z.infer<typeof priceMakerSchema>

export interface PriceMakerResult {
  listedCashPrice: number
  downPayment: number
  termMonths: number
  miFactor: number
  amountFinanced: number
  monthlyInstallment: number
  pnv: number
  totalPrice: number
  interestDifferential: number
  ppd: number
}
