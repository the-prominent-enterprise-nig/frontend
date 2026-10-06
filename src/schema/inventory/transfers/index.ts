import { z } from 'zod'
import { WarehouseBranchSchema } from '@/src/schema/inventory/warehouses'

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

// The requester never names a specific unit — they can't see what's
// physically on the shelf at the source. The serial is chosen at dispatch by
// whoever's holding the stock (see TransferDetailModal's dispatch form and
// the backend's assignDispatchSerials). A serial-tracked line still carries
// an ordinary quantity here; the backend's per-line invariant
// (validateSerialLineQuantities: exactly 1 unit per serial-tracked line) is
// satisfied by splitting that line into N single-unit lines at submit (see
// CreateTransferModal's handleFormSubmit), rather than making the requester
// add the same item N times themselves.
export const CreateTransferLineSchema = z
  .object({
    itemId: z.string().min(1, 'Item is required'),
    quantity: z.number().positive('Quantity must be greater than 0'),
    // Set only by Serial Numbers' "Consign to Caravan": the units were
    // ticked there, so the line is pinned to that exact serial (quantity 1)
    // instead of the source picking one at dispatch.
    serialNumberId: z.string().optional(),
    // Form-only — never sent to the server. Tells handleFormSubmit which
    // lines to split, and drives the row's own serial-tracked note.
    isSerialTracked: z.boolean().optional(),
    // Form-only — what the source has free right now (free serial units for a
    // serial-tracked item), filled in by the row once it has looked it up.
    // Unset while loading, so a slow lookup never blocks the form; the
    // backend's assertSourceHasStock makes the same check authoritatively.
    availableQty: z.number().optional(),
    // Form-only display context, captured from the search result that added
    // this line — the row renders the item as plain text (it's only ever
    // added through the card's own "Add item" search), so it needs the name
    // and SKU without a second lookup per row.
    itemLabel: z.string().optional(),
    itemSku: z.string().optional(),
  })
  .refine((l) => l.availableQty === undefined || l.quantity <= l.availableQty, {
    message: 'More than the source has available',
    path: ['quantity'],
  })

// Scenario 60 Part 2 — a caravan created inline from New Stock Transfer:
// a temporary branch parked at a real host branch for an event. Every field
// is required; there is no "somewhere else" venue option any more.
export const NewCaravanFormSchema = z
  .object({
    hostBranchId: z.string().min(1, 'Select the host branch'),
    eventName: z.string().trim().min(1, 'Enter the event name').max(150),
    // Where the caravan is physically set up — not required.
    location: z.string().trim().max(255, 'Keep the location under 255 characters').optional(),
    startDate: z.string().min(1, 'Enter the start date'),
    endDate: z.string().min(1, 'Enter the end date'),
  })
  .refine((d) => !d.startDate || !d.endDate || d.endDate >= d.startDate, {
    message: 'End date cannot be before the start date',
    path: ['endDate'],
  })
export type NewCaravanFormValues = z.infer<typeof NewCaravanFormSchema>

export const CreateTransferFormSchema = z
  .object({
    fromWarehouseId: z.string().min(1, 'Source warehouse is required'),
    // Required unless a new caravan is being created — see superRefine below.
    toWarehouseId: z.string(),
    // Form-only — whether the destination is a branch or a caravan. Never sent.
    destinationType: z.enum(['branch', 'caravan']).optional(),
    // Form-only — set while creating a caravan inline; it is created first
    // and its warehouse becomes toWarehouseId. Never sent with the transfer.
    newCaravan: NewCaravanFormSchema.optional(),
    transferDate: z.string().min(1, 'Transfer date is required'),
    expectedArrival: z.string().optional(),
    reason: z.string().max(500).optional(),
    // Scenario 50 — additive to the existing Stock Request flow, not a
    // replacement. Enforced server-side against inventory:transfers:direct;
    // the checkbox is hidden from anyone who lacks it (see CreateTransferModal),
    // so a submit without the permission is a defensive-only path.
    skipDestinationApproval: z.boolean().optional(),
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
  .superRefine((d, ctx) => {
    if (!d.newCaravan && !d.toWarehouseId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          d.destinationType === 'caravan'
            ? 'Select a caravan'
            : 'Destination warehouse is required',
        path: ['toWarehouseId'],
      })
    }
    // Mirrors the backend: a caravan carries serial-tracked units only,
    // since the host's POS sells caravan stock by serial.
    if (d.destinationType !== 'caravan') return
    d.lines.forEach((line, i) => {
      if (line.isSerialTracked === false) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Only serial-tracked items can be transferred to a caravan',
          path: ['lines', i, 'itemId'],
        })
      }
    })
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
  // Scenario 50 — optional, matching the request side. A dispatcher often
  // doesn't know the arrival date, and requiring it blocked the dispatch
  // over a field nothing downstream reads.
  expectedArrival: z.string().optional(),
  notes: z.string().max(500).optional(),
  serialAssignments: z.array(DispatchSerialAssignmentSchema).optional(),
  driverName: z.string().max(150).optional(),
  driverPhone: z.string().max(50).optional(),
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
    // Form-only — scopes the "different unit arrived" serial search to this
    // line's item. Stripped before the value is sent to the API.
    itemId: z.string().optional(),
    quantityReceived: z.number().min(0, 'Cannot be negative'),
    // "Wrong serial was sent" corrections — mutually exclusive. A typo-fix
    // rewrites the same physical unit's recorded serial in place;
    // a unit-swap repoints the line at a different unit that actually
    // arrived. Both require serial-override permission server-side.
    correctedSerialNumber: z.string().max(150).optional(),
    replacementSerialNumberId: z.string().optional(),
    // Form-only display context for the picked replacement — stripped
    // before the value is sent to the API.
    replacementSerialLabel: z.string().optional(),
    correctionReason: z.string().max(500).optional(),
  })
  .refine((d) => d.quantityReceived <= d.dispatchedQty, {
    message: 'Cannot receive more than what was dispatched',
    path: ['quantityReceived'],
  })
  .refine((d) => !d.isSerial || d.quantityReceived === 0 || d.quantityReceived === 1, {
    message: 'A serial line must be 0 (missing) or 1 (received)',
    path: ['quantityReceived'],
  })
  .refine((d) => !(d.correctedSerialNumber && d.replacementSerialNumberId), {
    message: 'Choose either a typo fix or a different unit, not both',
    path: ['correctedSerialNumber'],
  })
  .refine(
    (d) => !(d.correctedSerialNumber || d.replacementSerialNumberId) || d.quantityReceived === 1,
    {
      message: 'A corrected serial must be marked as received',
      path: ['quantityReceived'],
    }
  )
  .refine(
    (d) =>
      !(d.correctedSerialNumber || d.replacementSerialNumberId) || !!d.correctionReason?.trim(),
    {
      message: 'A reason is required when correcting a serial number',
      path: ['correctionReason'],
    }
  )

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
  branch: WarehouseBranchSchema.nullable().optional(),
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
  // Prisma Decimal columns serialize as STRINGS over JSON, not numbers.
  // Declaring these as z.number() made every row fail validation, which
  // failed the whole list parse and sent get-transfers.ts down its raw-cast
  // fallback — the real reason the pipeline tiles, status pills and
  // pagination all read zero. Coerce so both shapes parse; every consumer
  // already wraps these in Number().
  quantity: z.coerce.number(),
  receivedQuantity: z.coerce.number().nullable().optional(),
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
  // Set only when this line's serial was corrected at receipt — a wrong
  // serial was sent. Present (non-null) only for a unit-swap correction;
  // absent for a typo-fix, which rewrites serialNumber above in place.
  receiptCorrectedFromSerial: z
    .object({ id: z.string(), serialNumber: z.string() })
    .nullable()
    .optional(),
  receiptCorrectionReason: z.string().nullable().optional(),
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
  receivedDate: z.string().nullable().optional(),
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

// The backend nests pagination under `meta` (`{ data, meta: { total, page,
// limit, lastPage } }`), not at the top level — same shape as the stock
// balance and serial number endpoints. This schema used to declare the flat
// shape, so safeParse failed on every response and get-transfers.ts fell
// through to its raw `as TransferListResponse` cast: `total` was then
// undefined, which zeroed every pipeline tile and status pill on the Stock
// Transfers page and left pagination permanently hidden (totalPages became
// ceil(0 / limit) === 0). Parsing the real shape and transforming it back to
// a flat one fixes the counts without touching a single consumer.
export const TransferListResponseSchema = z
  .object({
    data: z.array(TransferSummarySchema),
    meta: z.object({
      total: z.number(),
      page: z.number(),
      limit: z.number(),
    }),
  })
  .transform(({ data, meta }) => ({
    data,
    total: meta.total,
    page: meta.page,
    limit: meta.limit,
  }))

export type TransferSummary = z.infer<typeof TransferSummarySchema>
export type TransferListResponse = z.infer<typeof TransferListResponseSchema>
