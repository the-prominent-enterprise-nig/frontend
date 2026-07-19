import { z } from 'zod'
import { CustomerSourceChannelEnum, CustomerStatusEnum, CustomerTypeEnum } from './types'

/** Selectable payment-terms options. COD and "Net N" values are parsed by
 * the backend's credit-eligibility check (assertCreditEligibility /
 * computeCreditWarnings) — the billing-cadence values (Monthly, Bi-Monthly,
 * etc.) have no automatic enforcement rule and are stored as-is. */
export const PAYMENT_TERMS_OPTIONS = [
  'COD',
  'Net 15',
  'Net 30',
  'Net 45',
  'Net 60',
  'Net 90',
  'Monthly',
  'Bi-Monthly',
  'Quarterly',
  'Semi-Annual',
  'Annual',
] as const

export const createCustomerSchema = z.object({
  tenantId: z.string().optional(),
  customerCode: z.string().max(20).optional(),
  name: z.string().min(1, 'Name is required').max(255),
  customerType: CustomerTypeEnum.optional(),
  companyName: z.string().max(255).optional().or(z.literal('')),
  taxId: z.string().max(50).optional().or(z.literal('')),
  isTaxExempt: z.boolean().optional(),
  taxExemptionRef: z.string().max(100).optional().or(z.literal('')),
  email: z.string().email('Invalid email').max(255).optional().or(z.literal('')),
  phone: z.string().max(50).optional().or(z.literal('')),
  billingAddress: z.string().max(1000).optional().or(z.literal('')),
  shippingAddress: z.string().max(1000).optional().or(z.literal('')),
  paymentTerms: z.string().max(50).optional().or(z.literal('')),
  creditLimit: z.coerce.number().min(0).optional(),
  sourceChannel: CustomerSourceChannelEnum.optional(),
  status: CustomerStatusEnum.optional(),
  notes: z.string().max(1000).optional().or(z.literal('')),
})
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>

export const updateCustomerSchema = createCustomerSchema.partial()
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>
