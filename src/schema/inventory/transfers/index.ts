import { z } from 'zod'

export const TransferStatusSchema = z.enum([
  'pending_manager_approval',
  'requested',
  'pending_hq_approval',
  'rejected',
  'draft',
  'in_transit',
  'received',
  'cancelled',
])

export const CreateTransferLineSchema = z
  .object({
    itemId: z.string().min(1, 'Item is required'),
    quantity: z.number().positive('Quantity must be greater than 0'),
    serialNumberId: z.string().optional(),
  })
  .refine((d) => !d.serialNumberId || d.quantity === 1, {
    message: 'A line with a specific serial must have quantity 1',
    path: ['quantity'],
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
  .refine((d) => !d.expectedArrival || d.expectedArrival >= d.transferDate, {
    message: 'Expected arrival cannot be before the transfer date',
    path: ['expectedArrival'],
  })

export const DispatchTransferFormSchema = z.object({
  expectedArrival: z.string().optional(),
  notes: z.string().max(500).optional(),
  driverName: z.string().max(150).optional(),
  driverPhone: z.string().max(50).optional(),
  driverLicense: z.string().max(100).optional(),
  vehiclePlate: z.string().max(50).optional(),
  carrierName: z.string().max(150).optional(),
})

export const ReceiveTransferFormSchema = z.object({
  receivedDate: z.string().min(1, 'Received date is required'),
  notes: z.string().max(500).optional(),
})

export const RejectHqTransferFormSchema = z.object({
  reason: z.string().min(1, 'A reason is required').max(500),
})

export const RejectTransferFormSchema = z.object({
  reason: z.string().min(1, 'A reason is required').max(500),
})

export const RejectManagerTransferFormSchema = z.object({
  reason: z.string().min(1, 'A reason is required').max(500),
})

export type CreateTransferFormValues = z.infer<typeof CreateTransferFormSchema>
export type CreateTransferLineValues = z.infer<typeof CreateTransferLineSchema>
export type DispatchTransferFormValues = z.infer<typeof DispatchTransferFormSchema>
export type ReceiveTransferFormValues = z.infer<typeof ReceiveTransferFormSchema>
export type RejectHqTransferFormValues = z.infer<typeof RejectHqTransferFormSchema>
export type RejectTransferFormValues = z.infer<typeof RejectTransferFormSchema>
export type RejectManagerTransferFormValues = z.infer<typeof RejectManagerTransferFormSchema>
export type TransferStatus = z.infer<typeof TransferStatusSchema>

const TransferWarehouseSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
  branchId: z.string().nullable().optional(),
})

const TransferLineSchema = z.object({
  id: z.string().optional(),
  itemId: z.string().optional(),
  item: z.object({ id: z.string(), name: z.string(), sku: z.string() }).optional(),
  quantity: z.number(),
  serialNumberId: z.string().nullable().optional(),
  serialNumber: z.object({ id: z.string(), serialNumber: z.string() }).nullable().optional(),
})

export const TransferSummarySchema = z.object({
  id: z.string(),
  status: TransferStatusSchema,
  transferNumber: z.string().optional(),
  fromWarehouse: TransferWarehouseSchema.optional(),
  toWarehouse: TransferWarehouseSchema.optional(),
  transferDate: z.string().optional(),
  expectedArrival: z.string().nullable().optional(),
  reason: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  dispatchedAt: z.string().nullable().optional(),
  receivedAt: z.string().nullable().optional(),
  cancelledAt: z.string().nullable().optional(),
  driverName: z.string().nullable().optional(),
  driverPhone: z.string().nullable().optional(),
  driverLicense: z.string().nullable().optional(),
  vehiclePlate: z.string().nullable().optional(),
  carrierName: z.string().nullable().optional(),
  requestedById: z.string().nullable().optional(),
  requestedByName: z.string().nullable().optional(),
  hqActedById: z.string().nullable().optional(),
  hqActedByName: z.string().nullable().optional(),
  hqActedAt: z.string().nullable().optional(),
  hqRejectedReason: z.string().nullable().optional(),
  acceptedById: z.string().nullable().optional(),
  acceptedByName: z.string().nullable().optional(),
  acceptedAt: z.string().nullable().optional(),
  branchActedById: z.string().nullable().optional(),
  branchActedByName: z.string().nullable().optional(),
  branchActedAt: z.string().nullable().optional(),
  branchRejectedReason: z.string().nullable().optional(),
  managerActedById: z.string().nullable().optional(),
  managerActedByName: z.string().nullable().optional(),
  managerActedAt: z.string().nullable().optional(),
  managerRejectedReason: z.string().nullable().optional(),
  lines: z.array(TransferLineSchema).optional(),
  _count: z.object({ lines: z.number() }).optional(),
  goodsReceipts: z
    .array(
      z.object({
        id: z.string(),
        code: z.string(),
        receivedAt: z.string().nullable().optional(),
      })
    )
    .optional(),
})

export const TransferListResponseSchema = z.object({
  data: z.array(TransferSummarySchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
})

export type TransferSummary = z.infer<typeof TransferSummarySchema>
export type TransferListResponse = z.infer<typeof TransferListResponseSchema>
