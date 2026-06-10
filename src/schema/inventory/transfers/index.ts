import { z } from 'zod'

export const TransferStatusSchema = z.enum(['draft', 'in_transit', 'received', 'cancelled'])

export const CreateTransferLineSchema = z.object({
  itemId: z.string().min(1, 'Item is required'),
  quantity: z.number().positive('Quantity must be greater than 0'),
})

export const CreateTransferFormSchema = z
  .object({
    fromWarehouseId: z.string().min(1, 'Source warehouse is required'),
    toWarehouseId: z.string().min(1, 'Destination warehouse is required'),
    transferDate: z.string().min(1, 'Transfer date is required'),
    expectedArrival: z.string().optional(),
    reason: z.string().max(500).optional(),
    lines: z.array(CreateTransferLineSchema).min(1, 'At least one item line is required'),
  })
  .refine((d) => d.fromWarehouseId !== d.toWarehouseId, {
    message: 'Source and destination warehouses must be different',
    path: ['toWarehouseId'],
  })

export const DispatchTransferFormSchema = z.object({
  expectedArrival: z.string().optional(),
  notes: z.string().max(500).optional(),
})

export const ReceiveTransferFormSchema = z.object({
  receivedDate: z.string().min(1, 'Received date is required'),
  notes: z.string().max(500).optional(),
})

export type CreateTransferFormValues = z.infer<typeof CreateTransferFormSchema>
export type CreateTransferLineValues = z.infer<typeof CreateTransferLineSchema>
export type DispatchTransferFormValues = z.infer<typeof DispatchTransferFormSchema>
export type ReceiveTransferFormValues = z.infer<typeof ReceiveTransferFormSchema>
export type TransferStatus = z.infer<typeof TransferStatusSchema>

const TransferWarehouseSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
})

const TransferLineSchema = z.object({
  id: z.string().optional(),
  itemId: z.string().optional(),
  item: z.object({ id: z.string(), name: z.string(), sku: z.string() }).optional(),
  quantity: z.number(),
})

export const TransferSummarySchema = z.object({
  id: z.string(),
  status: TransferStatusSchema,
  fromWarehouse: TransferWarehouseSchema.optional(),
  toWarehouse: TransferWarehouseSchema.optional(),
  transferDate: z.string().optional(),
  expectedArrival: z.string().nullable().optional(),
  reason: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  dispatchedAt: z.string().nullable().optional(),
  receivedAt: z.string().nullable().optional(),
  cancelledAt: z.string().nullable().optional(),
  lines: z.array(TransferLineSchema).optional(),
  _count: z.object({ lines: z.number() }).optional(),
})

export const TransferListResponseSchema = z.object({
  data: z.array(TransferSummarySchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
})

export type TransferSummary = z.infer<typeof TransferSummarySchema>
export type TransferListResponse = z.infer<typeof TransferListResponseSchema>
