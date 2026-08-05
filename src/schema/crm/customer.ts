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

/** Selectable ID types for the ID & Consent capture — common Philippine
 * government-issued IDs. No fixed NIG-accepted-ID list was specified
 * anywhere in the scenario docs, so this is a reasonable default set; the
 * backend field itself just stores whatever string is sent (VARCHAR(50)),
 * so widening this list later is a frontend-only change. */
/** Business-only sub-classification, alongside customerType (which stays
 * Individual/Business/Employee per the 2026-07-17 decision). */
export const BUSINESS_CATEGORY_OPTIONS = ['private', 'government'] as const

export const ID_TYPE_OPTIONS = [
  "Driver's License",
  'Passport',
  'UMID',
  'SSS ID',
  'PhilHealth ID',
  "Voter's ID",
  'Postal ID',
  'PRC ID',
  'TIN ID',
  'National ID (PhilSys)',
  'Company ID',
  'PWD ID',
] as const

export const CustomerBankAccountFormSchema = z.object({
  bankName: z.string().min(1, 'Bank name is required').max(100),
  accountNumber: z.string().min(1, 'Account number is required').max(50),
  accountName: z.string().max(150).optional().or(z.literal('')),
  isPrimary: z.boolean().optional(),
})
export type CustomerBankAccountFormValues = z.infer<typeof CustomerBankAccountFormSchema>

export const CoMakerFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  relationship: z.string().min(1, 'Relationship is required').max(100),
  contactNumber: z.string().min(1, 'Contact number is required').max(50),
  email: z.string().email('Invalid email').max(255).optional().or(z.literal('')),
})
export type CoMakerFormValues = z.infer<typeof CoMakerFormSchema>

export const createCustomerSchema = z.object({
  tenantId: z.string().optional(),
  customerCode: z.string().max(20).optional(),
  name: z.string().min(1, 'Name is required').max(255),
  customerType: CustomerTypeEnum.optional(),
  companyName: z.string().max(255).optional().or(z.literal('')),
  businessCategory: z.enum(['private', 'government']).optional().or(z.literal('')),
  employeeNumber: z.string().max(50).optional().or(z.literal('')),
  birthday: z.date().optional(),
  taxId: z.string().max(50).optional().or(z.literal('')),
  isTaxExempt: z.boolean().optional(),
  taxExemptionRef: z.string().max(100).optional().or(z.literal('')),
  email: z.string().email('Invalid email').max(255).optional().or(z.literal('')),
  phone: z.string().min(1, 'Phone number is required').max(50),
  billingAddress: z.string().max(1000).optional().or(z.literal('')),
  shippingAddress: z.string().max(1000).optional().or(z.literal('')),
  paymentTerms: z.string().max(50).optional().or(z.literal('')),
  creditLimit: z.coerce.number().min(0).optional(),
  groupId: z.string().max(50).optional().or(z.literal('')),
  sourceChannel: CustomerSourceChannelEnum.optional(),
  status: CustomerStatusEnum.optional(),
  notes: z.string().max(1000).optional().or(z.literal('')),
  bankAccounts: z.array(CustomerBankAccountFormSchema).max(20).optional(),
  coMakers: z.array(CoMakerFormSchema).max(5).optional(),
  idType: z.string().max(50).optional().or(z.literal('')),
  idNumber: z.string().max(100).optional().or(z.literal('')),
  idDocumentFileId: z.string().optional().or(z.literal('')),
  consentGiven: z.boolean().optional(),
  consentGivenAt: z.date().optional(),
})
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>

export const updateCustomerSchema = createCustomerSchema.partial()
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>
