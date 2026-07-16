import { z } from 'zod'

export const SUPPLIER_ONBOARDING_STATUSES = ['pending', 'in_review', 'approved', 'blocked'] as const
export const SUPPLIER_STATUSES = ['active', 'inactive', 'blacklisted'] as const

// ─── Create / Update Supplier ─────────────────────────────────────────────────

export const SupplierBankAccountFormSchema = z.object({
  bankName: z.string().min(1, 'Bank name is required').max(100),
  accountNumber: z.string().min(1, 'Account number is required').max(50),
  accountName: z.string().max(150).optional(),
  isPrimary: z.boolean().optional(),
})

export const CreateSupplierFormSchema = z.object({
  code: z.string().min(1, 'Supplier code is required').max(30),
  name: z.string().min(1, 'Name is required').max(255),
  legalName: z.string().max(255).optional(),
  taxId: z.string().max(50).optional(),
  contactPerson: z.string().max(255).optional(),
  email: z
    .string()
    .email('Please provide a valid email address')
    .max(150)
    .optional()
    .or(z.literal('')),
  phone: z.string().max(50).optional(),
  address: z.string().max(500).optional(),
  paymentTerms: z.string().max(50).optional(),
  discountTerms: z.string().max(50).optional(),
  currency: z.string().max(3).optional(),
  bankAccounts: z.array(SupplierBankAccountFormSchema).max(20).optional(),
  creditLimit: z.number().min(0).optional(),
  onboardingStatus: z.enum(SUPPLIER_ONBOARDING_STATUSES).optional(),
  status: z.enum(SUPPLIER_STATUSES).optional(),
  notes: z.string().max(1000).optional(),
})

const CreateSupplierServerSchema = CreateSupplierFormSchema.extend({
  creditLimit: z.coerce.number().min(0).optional(),
})

export const UpdateSupplierFormSchema = CreateSupplierFormSchema.partial()
const UpdateSupplierServerSchema = CreateSupplierServerSchema.partial()

export { CreateSupplierServerSchema, UpdateSupplierServerSchema }

// ─── Response shapes ───────────────────────────────────────────────────────────

export const SupplierBankAccountSchema = z.object({
  id: z.string(),
  bankName: z.string(),
  accountNumber: z.string(),
  accountName: z.string().optional().nullable(),
  isPrimary: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const SupplierListItemSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  contactPerson: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  paymentTerms: z.string(),
  currency: z.string(),
  onboardingStatus: z.enum(SUPPLIER_ONBOARDING_STATUSES),
  status: z.enum(SUPPLIER_STATUSES),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const SupplierDetailSchema = SupplierListItemSchema.extend({
  legalName: z.string().optional().nullable(),
  taxId: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  discountTerms: z.string().optional().nullable(),
  bankAccounts: z.array(SupplierBankAccountSchema),
  creditLimit: z.coerce.number().optional().nullable(),
  notes: z.string().optional().nullable(),
  deletedAt: z.string().optional().nullable(),
})

export const PaginatedSupplierSchema = z.object({
  data: z.array(SupplierListItemSchema),
  meta: z.object({
    total: z.number(),
    page: z.number(),
    limit: z.number(),
    lastPage: z.number(),
  }),
})

export type SupplierBankAccountFormValues = z.infer<typeof SupplierBankAccountFormSchema>
export type CreateSupplierFormValues = z.infer<typeof CreateSupplierFormSchema>
export type UpdateSupplierFormValues = z.infer<typeof UpdateSupplierFormSchema>
export type SupplierBankAccount = z.infer<typeof SupplierBankAccountSchema>
export type SupplierListItem = z.infer<typeof SupplierListItemSchema>
export type SupplierDetail = z.infer<typeof SupplierDetailSchema>
export type PaginatedSupplier = z.infer<typeof PaginatedSupplierSchema>
