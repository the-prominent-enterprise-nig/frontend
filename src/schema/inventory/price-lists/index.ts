import { z } from 'zod'

export const PriceListTypeEnum = z.enum(['standard', 'promotional', 'contract', 'wholesale'])
export type PriceListType = z.infer<typeof PriceListTypeEnum>

export const PriceListStatusEnum = z.enum(['active', 'inactive', 'archived'])
export type PriceListStatus = z.infer<typeof PriceListStatusEnum>

export const PriceListFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  listType: PriceListTypeEnum,
  description: z.string().optional(),
  currency: z.string().min(1, 'Currency is required'),
  effectiveFrom: z.string().optional(),
  effectiveTo: z.string().optional(),
  priority: z.number().int(),
  status: PriceListStatusEnum,
})
export type PriceListFormValues = z.infer<typeof PriceListFormSchema>

export const PriceListSchema = z.object({
  id: z.string(),
  name: z.string(),
  listType: PriceListTypeEnum,
  description: z.string().optional().nullable(),
  currency: z.string(),
  effectiveFrom: z.string().optional().nullable(),
  effectiveTo: z.string().optional().nullable(),
  priority: z.number(),
  status: PriceListStatusEnum,
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})

export const PriceListListResponseSchema = z.object({
  data: z.array(PriceListSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
})

export type PriceList = z.infer<typeof PriceListSchema>
export type PriceListListResponse = z.infer<typeof PriceListListResponseSchema>
