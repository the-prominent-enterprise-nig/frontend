import { z } from 'zod'

export const PriceUseTypeRefSchema = z.object({
  id: z.string(),
  name: z.string(),
})
export type PriceUseTypeRef = z.infer<typeof PriceUseTypeRefSchema>

export const PriceListStatusEnum = z.enum([
  'pending_approval',
  'active',
  'rejected',
  'inactive',
  'expired',
])
export type PriceListStatus = z.infer<typeof PriceListStatusEnum>

export const PriceListFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  priceUseTypeId: z.string().min(1, 'Price use type is required'),
  description: z.string().optional(),
  currency: z.string().min(1, 'Currency is required'),
  effectiveFrom: z.string().optional(),
  effectiveTo: z.string().optional(),
  priority: z.number().int(),
  allowedBranchIds: z.array(z.string()).optional(),
  supersedesId: z.string().optional(),
})
export type PriceListFormValues = z.infer<typeof PriceListFormSchema>

export const PriceListSchema = z.object({
  id: z.string(),
  name: z.string(),
  priceUseTypeId: z.string(),
  priceUseType: PriceUseTypeRefSchema.optional().nullable(),
  description: z.string().optional().nullable(),
  currency: z.string(),
  effectiveFrom: z.string().optional().nullable(),
  effectiveTo: z.string().optional().nullable(),
  priority: z.number(),
  status: PriceListStatusEnum,
  allowedBranchIds: z.array(z.string()).optional().default([]),
  approverId: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
  actedAt: z.string().optional().nullable(),
  supersedesId: z.string().optional().nullable(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  itemCount: z.number().optional().default(0),
})

export const PriceListItemSchema = z.object({
  id: z.string(),
  itemId: z.string(),
  price: z.union([z.string(), z.number()]),
  floorPrice: z.union([z.string(), z.number()]).optional().nullable(),
  minQty: z.union([z.string(), z.number()]).optional().nullable(),
  // Scenario 15, Part 5
  downPayment: z.union([z.string(), z.number()]).optional().nullable(),
  // Scenario 34 — cmAmount/creditAmount existed on the backend since
  // Scenario 15 Part 5 but had no frontend form/table surface until now.
  cmAmount: z.union([z.string(), z.number()]).optional().nullable(),
  creditAmount: z.union([z.string(), z.number()]).optional().nullable(),
  item: z.object({ id: z.string(), sku: z.string(), name: z.string() }),
})
export type PriceListItem = z.infer<typeof PriceListItemSchema>

export const PriceListDetailSchema = PriceListSchema.extend({
  items: z.array(PriceListItemSchema).default([]),
})
export type PriceListDetail = z.infer<typeof PriceListDetailSchema>

export const PriceListItemsPageSchema = z.object({
  data: z.array(PriceListItemSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
})
export type PriceListItemsPage = z.infer<typeof PriceListItemsPageSchema>

export const UpsertPriceListItemFormSchema = z.object({
  itemId: z.string().min(1, 'Select an item'),
  price: z.number().min(0, 'Price must be 0 or more'),
  floorPrice: z.number().min(0).optional(),
  minQty: z.number().min(0).optional(),
  // Scenario 15, Part 5
  downPayment: z.number().min(0).optional(),
  // Scenario 34
  cmAmount: z.number().min(0).optional(),
  creditAmount: z.number().min(0).optional(),
})
export type UpsertPriceListItemFormValues = z.infer<typeof UpsertPriceListItemFormSchema>

export const ApprovePriceListFormSchema = z.object({
  remarks: z.string().max(500).optional(),
})
export type ApprovePriceListFormValues = z.infer<typeof ApprovePriceListFormSchema>

export const RejectPriceListFormSchema = z.object({
  remarks: z
    .string()
    .min(1, 'Reason is required')
    .max(500, 'Reason must be 500 characters or less'),
})
export type RejectPriceListFormValues = z.infer<typeof RejectPriceListFormSchema>

export const PriceListListResponseSchema = z.object({
  data: z.array(PriceListSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
})

export type PriceList = z.infer<typeof PriceListSchema>
export type PriceListListResponse = z.infer<typeof PriceListListResponseSchema>

export const ItemPriceGuideTermSchema = z.object({
  termMonths: z.number(),
  monthlyInstallment: z.union([z.string(), z.number()]),
  ppd: z.union([z.string(), z.number()]).optional().nullable(),
})
export type ItemPriceGuideTerm = z.infer<typeof ItemPriceGuideTermSchema>

export const ItemPriceGuideEntrySchema = z.object({
  priceUseType: z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional().nullable(),
  }),
  priceListId: z.string(),
  priceListName: z.string(),
  price: z.union([z.string(), z.number()]),
  floorPrice: z.union([z.string(), z.number()]).optional().nullable(),
  downPayment: z.union([z.string(), z.number()]).optional().nullable(),
  minQty: z.union([z.string(), z.number()]).optional().nullable(),
  cmAmount: z.union([z.string(), z.number()]).optional().nullable(),
  creditAmount: z.union([z.string(), z.number()]).optional().nullable(),
  terms: z.array(ItemPriceGuideTermSchema).default([]),
})
export type ItemPriceGuideEntry = z.infer<typeof ItemPriceGuideEntrySchema>

export const ItemPriceGuideSchema = z.array(ItemPriceGuideEntrySchema)
