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

// No serialNumberId here — the requester never picks the specific unit, they
// only know they need one (or more, one line each) of a serial-tracked item.
// The physical serial is chosen later by whoever's dispatching, at dispatch
// time (see DispatchTransferFormSchema's serialAssignments below).
export const CreateTransferLineSchema = z
  .object({
    itemId: z.string().min(1, 'Item is required'),
    quantity: z.number().positive('Quantity must be greater than 0'),
    // Form-only — never sent to the server. Lets the create form know at
    // submit time which lines to split into N quantity-1 lines (the backend
    // still enforces exactly 1 unit per serial-tracked line; see
    // CreateTransferModal's handleFormSubmit).
    isSerialTracked: z.boolean().optional(),
  })
  .refine((line) => !line.isSerialTracked || Number.isInteger(line.quantity), {
    message: 'Serial-tracked items must be a whole number of units',
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

// One entry per serial-tracked line being dispatched — itemId/itemLabel are
// form-only display context (which serial dropdown this is, and what to
// fetch in-stock options for), stripped before the request is sent.
export const DispatchSerialAssignmentSchema = z.object({
  lineId: z.string().min(1),
  itemId: z.string().optional(),
  itemLabel: z.string().optional(),
  serialNumberId: z.string().min(1, 'Select a serial number'),
  // Form-only — never sent to the server. The dispatch form groups every
  // serial-tracked slot for the same item under one search box; a picked
  // serial's own display string is captured here purely so it can render as
  // a pill without a second lookup (see TransferDetailModal's ItemSerialGroup).
  serialLabel: z.string().optional(),
  // Scenario 29 SN-01 — supervisor override: dispatch this serial even
  // though it fails the normal in-stock/source-warehouse check. Requires
  // inventory:transfers:serial-override and overrideReason server-side.
  override: z.boolean().optional(),
  overrideReason: z.string().max(500).optional(),
})

export const DispatchTransferFormSchema = z.object({
  expectedArrival: z.string().min(1, 'Expected arrival date is required'),
  notes: z.string().max(500).optional(),
  serialAssignments: z.array(DispatchSerialAssignmentSchema).optional(),
  driverName: z.string().min(1, "Driver's name is required").max(150),
  driverPhone: z.string().min(1, "Driver's contact number is required").max(50),
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
export type DispatchSerialAssignmentValues = z.infer<typeof DispatchSerialAssignmentSchema>
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
  // Set only on the 2 real standalone warehouses (Scenario 27); null for a
  // branch-local one. For a branch-local warehouse the UI shows `branch`'s
  // name instead of the warehouse's own "{branch} Warehouse" name.
  region: z.enum(['panay', 'negros']).nullable().optional(),
  branch: z.object({ id: z.string(), name: z.string() }).nullable().optional(),
})

const TransferLineSchema = z.object({
  id: z.string().optional(),
  itemId: z.string().optional(),
  item: z
    .object({
      id: z.string(),
      name: z.string(),
      sku: z.string(),
      isSerialTracked: z.boolean().optional(),
    })
    .optional(),
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
  // Present only for a repair transfer auto-paired by the UDS module — that
  // flow already tracks its specific serial separately (UnitDocumentSheet's
  // own lines), so dispatch never requires a serialAssignments entry for
  // this transfer's lines even when they're serial-tracked.
  linkedUds: z.array(z.object({ id: z.string() })).optional(),
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
