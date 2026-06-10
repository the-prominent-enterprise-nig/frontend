import { z } from 'zod'
import { CustomerSourceChannelEnum, CustomerStatusEnum, CustomerTypeEnum } from './types'

export const createCustomerSchema = z.object({
  tenantId: z.string().min(1, 'Enterprise Owner is required'),
  customerCode: z.string().min(1, 'Customer code is required').max(20),
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
