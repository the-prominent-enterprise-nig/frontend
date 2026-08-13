import { z } from 'zod'

export const NegativeStockPolicyEnum = z.enum(['block', 'warn', 'allow'])
export type NegativeStockPolicy = z.infer<typeof NegativeStockPolicyEnum>

export const NegativeStockPolicyFormSchema = z.object({
  defaultPolicy: NegativeStockPolicyEnum,
})
export type NegativeStockPolicyFormValues = z.infer<typeof NegativeStockPolicyFormSchema>

export const NegativeStockPolicySchema = z.object({
  id: z.string().optional(),
  defaultPolicy: NegativeStockPolicyEnum,
  updatedAt: z.string().optional(),
})

export const NegativeStockViolationSchema = z.object({
  itemId: z.string().optional().nullable(),
  itemName: z.string().optional().nullable(),
  sku: z.string().optional().nullable(),
  warehouseId: z.string().optional().nullable(),
  warehouseName: z.string().optional().nullable(),
  onHandQty: z.number(),
  availableQty: z.number().optional(),
})

export const NegativeStockViolationListResponseSchema = z.object({
  data: z.array(NegativeStockViolationSchema),
  total: z.number().optional(),
  page: z.number().optional(),
  limit: z.number().optional(),
})

export type NegativeStockPolicyData = z.infer<typeof NegativeStockPolicySchema>
export type NegativeStockViolation = z.infer<typeof NegativeStockViolationSchema>
export type NegativeStockViolationListResponse = z.infer<
  typeof NegativeStockViolationListResponseSchema
>
