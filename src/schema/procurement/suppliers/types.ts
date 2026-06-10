import { z } from 'zod'

export const SupplierStatusSchema = z.enum(['active', 'inactive', 'blacklisted'])
export const SupplierOnboardingStatusSchema = z.enum([
  'pending',
  'in_review',
  'approved',
  'blocked',
])
export const SupplierDocumentTypeSchema = z.enum([
  'business_permit',
  'bir_2303',
  'insurance',
  'certification',
  'contract',
  'other',
])

export const SupplierDocumentSchema = z.object({
  id: z.string(),
  documentType: SupplierDocumentTypeSchema,
  name: z.string(),
  fileUrl: z.string().nullable().optional(),
  issueDate: z.string().nullable().optional(),
  expiryDate: z.string().nullable().optional(),
  isMandatory: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const SupplierBankAccountSchema = z.object({
  id: z.string(),
  bankName: z.string(),
  accountNumber: z.string(),
  accountName: z.string().nullable().optional(),
  isPrimary: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const SupplierBankAccountInputSchema = z.object({
  bankName: z.string().min(1, 'Bank name is required').max(100),
  accountNumber: z.string().min(1, 'Account number is required').max(50),
  accountName: z.string().max(150).optional().or(z.literal('')),
  isPrimary: z.boolean().optional(),
})

export const SupplierSchema = z.object({
  id: z.string(),
  code: z.string().min(1, 'Code is required'),
  name: z.string().min(1, 'Name is required'),
  legalName: z.string().nullable().optional(),
  taxId: z.string().nullable().optional(),
  contactPerson: z.string().nullable().optional(),
  email: z.email('Invalid email').nullable().optional().or(z.literal('')),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  paymentTerms: z.string(),
  discountTerms: z.string().nullable().optional(),
  currency: z.string(),
  bankAccounts: z.array(SupplierBankAccountSchema).optional(),
  creditLimit: z.coerce.number().nullable().optional(),
  onboardingStatus: SupplierOnboardingStatusSchema,
  status: SupplierStatusSchema,
  notes: z.string().nullable().optional(),
  documents: z.array(SupplierDocumentSchema).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable().optional(),
})

export const SupplierFormDataSchema = SupplierSchema.omit({
  id: true,
  documents: true,
  bankAccounts: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
}).extend({
  code: z.string().min(1, 'Code is required').max(30),
  name: z.string().min(1, 'Name is required').max(255),
  paymentTerms: z.string().min(1, 'Payment terms required'),
  currency: z.string().min(1, 'Currency required'),
  onboardingStatus: SupplierOnboardingStatusSchema,
  status: SupplierStatusSchema,
  bankAccounts: z.array(SupplierBankAccountInputSchema).max(20).optional(),
})

export const MetaSchema = z.object({
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  lastPage: z.number().int().nonnegative(),
})

export const SupplierListResponseSchema = z.object({
  data: z.array(SupplierSchema.partial({ documents: true })),
  meta: MetaSchema,
})

export const SupplierQueryParamsSchema = z.object({
  search: z.string().optional(),
  status: SupplierStatusSchema.optional(),
  onboardingStatus: SupplierOnboardingStatusSchema.optional(),
  page: z.number().int().positive().optional().default(1),
  limit: z.number().int().positive().optional().default(10),
})

export type SupplierStatus = z.infer<typeof SupplierStatusSchema>
export type SupplierOnboardingStatus = z.infer<typeof SupplierOnboardingStatusSchema>
export type SupplierDocumentType = z.infer<typeof SupplierDocumentTypeSchema>
export type SupplierDocument = z.infer<typeof SupplierDocumentSchema>
export type SupplierBankAccount = z.infer<typeof SupplierBankAccountSchema>
export type SupplierBankAccountInput = z.infer<typeof SupplierBankAccountInputSchema>
export type Supplier = z.infer<typeof SupplierSchema>
export type SupplierFormData = z.infer<typeof SupplierFormDataSchema>
export type SupplierListResponse = z.infer<typeof SupplierListResponseSchema>
export type SupplierQueryParams = z.infer<typeof SupplierQueryParamsSchema>
export type Meta = z.infer<typeof MetaSchema>
