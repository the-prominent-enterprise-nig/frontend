import { z } from 'zod'

export const TransferStatusSchema = z.enum([
  'pending_manager_approval',
  'requested',
  'pending_hq_approval',
  'rejected',
  'draft',
  'in_transit',
  'received',
  'partially_received',
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
  expectedArrival: z.string().min(1, 'Expected arrival date is required'),
  notes: z.string().max(500).optional(),
  driverName: z.string().min(1, "Driver's name is required").max(150),
  driverPhone: z.string().min(1, "Driver's contact number is required").max(50),
  driverLicense: z.string().min(1, "Driver's license number is required").max(100),
  vehiclePlate: z.string().min(1, 'Vehicle plate number is required').max(50),
  carrierName: z.string().min(1, 'Carrier name is required').max(150),
})

export const ReceiveTransferLineSchema = z
  .object({
    stockTransferLineId: z.string().min(1),
    // Read-only context carried in the form for display/validation only —
    // stripped before the value is sent to the API.
    dispatchedQty: z.number(),
    isSerial: z.boolean(),
    serialLabel: z.string().optional(),
    itemLabel: z.string().optional(),
    quantityReceived: z.number().min(0, 'Cannot be negative'),
  })
  .refine((d) => d.quantityReceived <= d.dispatchedQty, {
    message: 'Cannot receive more than what was dispatched',
    path: ['quantityReceived'],
  })
  .refine((d) => !d.isSerial || d.quantityReceived === 0 || d.quantityReceived === 1, {
    message: 'A serial line must be 0 (missing) or 1 (received)',
    path: ['quantityReceived'],
  })

export const ReceiveTransferExtraLineSchema = z.object({
  itemId: z.string().min(1, 'Item is required'),
  quantity: z.number().positive('Quantity must be greater than 0'),
  notes: z.string().max(500).optional(),
})

export const ReceiveTransferFormSchema = z.object({
  receivedDate: z.string().min(1, 'Received date is required'),
  notes: z.string().max(500).optional(),
  lines: z.array(ReceiveTransferLineSchema).min(1, 'At least one line is required'),
  extraLines: z.array(ReceiveTransferExtraLineSchema).optional(),
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
export type ReceiveTransferLineValues = z.infer<typeof ReceiveTransferLineSchema>
export type ReceiveTransferExtraLineValues = z.infer<typeof ReceiveTransferExtraLineSchema>
export type RejectHqTransferFormValues = z.infer<typeof RejectHqTransferFormSchema>
export type RejectTransferFormValues = z.infer<typeof RejectTransferFormSchema>
export type RejectManagerTransferFormValues = z.infer<typeof RejectManagerTransferFormSchema>
export type TransferStatus = z.infer<typeof TransferStatusSchema>

const TransferWarehouseSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
  branchId: z.string().nullable().optional(),
  // Each branch has exactly one warehouse — the UI displays this branch name
  // rather than the warehouse's own "{branch} Warehouse" name.
  branch: z.object({ id: z.string(), name: z.string() }).nullable().optional(),
})

const TransferLineSchema = z.object({
  id: z.string().optional(),
  itemId: z.string().optional(),
  item: z.object({ id: z.string(), name: z.string(), sku: z.string() }).optional(),
  quantity: z.number(),
  receivedQuantity: z.number().nullable().optional(),
  serialNumberId: z.string().nullable().optional(),
  serialNumber: z
    .object({
      id: z.string(),
      serialNumber: z.string(),
      status: z.string().nullable().optional(),
      currentWarehouseId: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
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
        // Extra/unlisted items received alongside the transfer — lines with
        // no stockTransferLineId, i.e. not a reconciled dispatched line.
        lines: z
          .array(
            z.object({
              id: z.string(),
              itemId: z.string(),
              item: z.object({ id: z.string(), name: z.string(), sku: z.string() }).optional(),
              quantityReceived: z.number(),
              notes: z.string().nullable().optional(),
            })
          )
          .optional(),
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
