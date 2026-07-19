import { z } from 'zod'
import {
  InstallmentAccountCategoryEnum,
  InstallmentAccountClassificationEnum,
  InstallmentAccountStatusEnum,
} from './types'

export const createInstallmentAccountSchema = z.object({
  accountNumber: z.string().min(1, 'Account number is required').max(30),
  customerId: z.string().min(1, 'Customer is required'),
  branchId: z.string().optional().or(z.literal('')),
  collectorId: z.string().optional().or(z.literal('')),
  arInvoiceId: z.string().optional().or(z.literal('')),
  listedCashPrice: z.coerce.number().min(0, 'Listed cash price must be 0 or more'),
  downPayment: z.coerce.number().min(0, 'Down payment must be 0 or more'),
  termMonths: z.coerce
    .number()
    .int()
    .min(1, 'Term must be at least 1 month')
    .max(12, 'Term cannot exceed 12 months'),
  miFactor: z.coerce.number().min(0, 'MI factor must be 0 or more'),
  lastOrNumber: z.string().optional().or(z.literal('')),
  lastOrDate: z.string().optional().or(z.literal('')),
  lastOrAmount: z.coerce.number().min(0).optional(),
})

export type CreateInstallmentAccountInput = z.infer<typeof createInstallmentAccountSchema>

export const updateInstallmentAccountSchema = createInstallmentAccountSchema.partial().extend({
  status: InstallmentAccountStatusEnum.optional(),
  category: InstallmentAccountCategoryEnum.optional(),
  classification: InstallmentAccountClassificationEnum.optional(),
  agingBucket: z.string().optional().or(z.literal('')),
  arrears: z.coerce.number().min(0).optional(),
  penalty: z.coerce.number().min(0).optional(),
})

export type UpdateInstallmentAccountInput = z.infer<typeof updateInstallmentAccountSchema>

export const earlyPayoffSchema = z.object({
  payoffAmount: z.coerce.number().min(0.01, 'Payoff amount must be greater than 0'),
  paidAt: z.string().min(1, 'Payoff date is required'),
  orNumber: z.string().max(50).optional().or(z.literal('')),
})

export type EarlyPayoffInput = z.infer<typeof earlyPayoffSchema>

export const recordPaymentSchema = z.object({
  amount: z.coerce.number().min(0.01, 'Amount must be greater than 0'),
  dueDate: z.string().min(1, 'Due date is required'),
  paidAt: z.string().min(1, 'Paid date is required'),
  orNumber: z.string().max(50).optional().or(z.literal('')),
})

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>

export const priceCheckSchema = z.object({
  listedCashPrice: z.coerce.number().min(0, 'Listed cash price must be 0 or more'),
  downPayment: z.coerce.number().min(0, 'Down payment must be 0 or more'),
  termMonths: z.coerce
    .number()
    .int()
    .min(1, 'Term must be at least 1 month')
    .max(12, 'Term cannot exceed 12 months'),
  miFactor: z.coerce.number().min(0, 'MI factor must be 0 or more'),
})

export type PriceCheckInput = z.infer<typeof priceCheckSchema>

export interface PriceCheckResult {
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
