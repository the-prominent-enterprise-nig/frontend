import { z } from 'zod'

export const LandedCostAllocationMethodEnum = z.enum(['by_quantity', 'by_value', 'by_weight'])
export type LandedCostAllocationMethod = z.infer<typeof LandedCostAllocationMethodEnum>

export const LandedCostComponentTypeEnum = z.enum([
  'freight',
  'duty',
  'insurance',
  'broker',
  'other',
])
export type LandedCostComponentType = z.infer<typeof LandedCostComponentTypeEnum>

export const LandedCostLineSchema = z.object({
  componentType: LandedCostComponentTypeEnum,
  amount: z.number().positive('Amount must be greater than 0'),
  vendorId: z.string().optional(),
  notes: z.string().optional(),
})
export type LandedCostLine = z.infer<typeof LandedCostLineSchema>

export const LandedCostFormSchema = z.object({
  goodsReceiptId: z.string().min(1, 'Goods receipt is required'),
  allocationMethod: LandedCostAllocationMethodEnum,
  notes: z.string().optional(),
  lines: z.array(LandedCostLineSchema).min(1, 'At least one cost line is required'),
})
export type LandedCostFormValues = z.infer<typeof LandedCostFormSchema>

const GoodsReceiptRefSchema = z.object({
  id: z.string(),
  code: z.string().optional().nullable(),
  receiptNumber: z.string().optional().nullable(),
})

export const LandedCostRecordSchema = z.object({
  id: z.string(),
  goodsReceiptId: z.string(),
  goodsReceipt: GoodsReceiptRefSchema.optional().nullable(),
  allocationMethod: LandedCostAllocationMethodEnum,
  totalLandedCost: z.number().optional().nullable(),
  notes: z.string().optional().nullable(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})

export const LandedCostListResponseSchema = z.object({
  data: z.array(LandedCostRecordSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
})

export type LandedCostRecord = z.infer<typeof LandedCostRecordSchema>
export type LandedCostListResponse = z.infer<typeof LandedCostListResponseSchema>

export const GoodsReceiptRefListResponseSchema = z.object({
  data: z.array(
    GoodsReceiptRefSchema.extend({
      id: z.string(),
      code: z.string().optional().nullable(),
      receiptNumber: z.string().optional().nullable(),
      createdAt: z.string().optional(),
    })
  ),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
})

export type GoodsReceiptRef = z.infer<typeof GoodsReceiptRefSchema>
export type GoodsReceiptRefListResponse = z.infer<typeof GoodsReceiptRefListResponseSchema>
