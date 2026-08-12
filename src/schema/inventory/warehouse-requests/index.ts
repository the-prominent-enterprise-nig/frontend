import { z } from 'zod'

export const WarehouseRequestStatusSchema = z.enum([
  'requested',
  'ready',
  'rejected',
  'in_transit',
  'received',
  'partially_received',
  'cancelled',
])

export const WarehouseRequestDirectionSchema = z.enum(['pull', 'push'])

export const CreateWarehouseRequestLineSchema = z
  .object({
    itemId: z.string().min(1, 'Item is required'),
    variantId: z.string().optional(),
    quantity: z.number().positive('Quantity must be greater than 0'),
    serialNumberId: z.string().optional(),
  })
  .refine((d) => !d.serialNumberId || d.quantity === 1, {
    message: 'A line with a specific serial must have quantity 1',
    path: ['quantity'],
  })

export const CreateWarehouseRequestFormSchema = z.object({
  warehouseId: z.string().min(1, 'Warehouse is required'),
  // Falls back to the caller's own branch server-side if omitted — required
  // only for an unrestricted (Head Office) caller. Pull vs. push is no
  // longer a client choice; the server derives it from who's creating this.
  branchId: z.string().optional(),
  notes: z.string().max(500).optional(),
  lines: z.array(CreateWarehouseRequestLineSchema).min(1, 'At least one item line is required'),
})

export const CancelWarehouseRequestFormSchema = z.object({
  reason: z.string().max(500).optional(),
})

export const RejectWarehouseRequestFormSchema = z.object({
  reason: z.string().min(1, 'A reason is required').max(500),
})

export type CreateWarehouseRequestFormValues = z.infer<typeof CreateWarehouseRequestFormSchema>
export type CreateWarehouseRequestLineValues = z.infer<typeof CreateWarehouseRequestLineSchema>
export type CancelWarehouseRequestFormValues = z.infer<typeof CancelWarehouseRequestFormSchema>
export type RejectWarehouseRequestFormValues = z.infer<typeof RejectWarehouseRequestFormSchema>
export type WarehouseRequestStatus = z.infer<typeof WarehouseRequestStatusSchema>
export type WarehouseRequestDirection = z.infer<typeof WarehouseRequestDirectionSchema>

const WarehouseRequestWarehouseSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
  region: z.enum(['panay', 'negros']).nullable().optional(),
})

const WarehouseRequestBranchSchema = z.object({
  id: z.string(),
  name: z.string(),
})

const WarehouseRequestLineSchema = z.object({
  id: z.string(),
  itemId: z.string(),
  item: z.object({ id: z.string(), sku: z.string(), name: z.string() }).optional(),
  variantId: z.string().nullable().optional(),
  quantity: z.number(),
  receivedQuantity: z.number().optional(),
  serialNumberId: z.string().nullable().optional(),
  serialNumber: z
    .object({ id: z.string(), serialNumber: z.string(), status: z.string().optional() })
    .nullable()
    .optional(),
})

export const WarehouseRequestSummarySchema = z.object({
  id: z.string(),
  requestNumber: z.string(),
  warehouseId: z.string(),
  warehouse: WarehouseRequestWarehouseSchema.optional(),
  branchId: z.string(),
  branch: WarehouseRequestBranchSchema.nullable().optional(),
  direction: WarehouseRequestDirectionSchema,
  status: WarehouseRequestStatusSchema,
  notes: z.string().nullable().optional(),
  requestedById: z.string().nullable().optional(),
  requestedByIdName: z.string().nullable().optional(),
  requestedAt: z.string().optional(),
  acceptedById: z.string().nullable().optional(),
  acceptedByIdName: z.string().nullable().optional(),
  acceptedAt: z.string().nullable().optional(),
  rejectedById: z.string().nullable().optional(),
  rejectedByIdName: z.string().nullable().optional(),
  rejectedAt: z.string().nullable().optional(),
  rejectedReason: z.string().nullable().optional(),
  dispatchedById: z.string().nullable().optional(),
  dispatchedByIdName: z.string().nullable().optional(),
  dispatchedAt: z.string().nullable().optional(),
  receivedById: z.string().nullable().optional(),
  receivedByIdName: z.string().nullable().optional(),
  receivedAt: z.string().nullable().optional(),
  cancelledById: z.string().nullable().optional(),
  cancelledByIdName: z.string().nullable().optional(),
  cancelledAt: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  lines: z.array(WarehouseRequestLineSchema).optional(),
})

// The backend returns `{ data, meta: { total, page, limit, lastPage } }`
// (see warehouse-requests.service.ts's findAll) — unlike Transfers' flat
// `{ data, total, page, limit }`. Don't flatten this to match Transfers'
// shape; it would silently break pagination like the pre-existing
// warehouses.service.ts/get-warehouses.ts mismatch does.
export const WarehouseRequestListResponseSchema = z.object({
  data: z.array(WarehouseRequestSummarySchema),
  meta: z.object({
    total: z.number(),
    page: z.number(),
    limit: z.number(),
    lastPage: z.number(),
  }),
})

export type WarehouseRequestSummary = z.infer<typeof WarehouseRequestSummarySchema>
export type WarehouseRequestListResponse = z.infer<typeof WarehouseRequestListResponseSchema>
