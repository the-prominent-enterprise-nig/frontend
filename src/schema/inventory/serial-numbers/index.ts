import { z } from 'zod'

// Mirrors the backend's SerialNumberStatus enum exactly (backend/prisma/schema.prisma)
export const SerialStatusSchema = z.enum([
  'in_stock',
  'held',
  'sold',
  'returned',
  'defective',
  'scrapped',
  'in_repair',
  'pulled_out',
])
export type SerialStatus = z.infer<typeof SerialStatusSchema>

export const SERIAL_STATUS_LABELS: Record<SerialStatus, string> = {
  in_stock: 'In Stock',
  held: 'Held',
  sold: 'Sold',
  returned: 'Returned',
  defective: 'Defective',
  scrapped: 'Scrapped',
  in_repair: 'In Repair',
  pulled_out: 'Pulled Out',
}

export const SERIAL_STATUS_COLORS: Record<SerialStatus, string> = {
  in_stock: 'bg-green-100 text-green-700',
  held: 'bg-amber-100 text-amber-700',
  sold: 'bg-blue-100 text-blue-700',
  returned: 'bg-yellow-100 text-yellow-700',
  defective: 'bg-red-100 text-red-700',
  scrapped: 'bg-zinc-100 text-zinc-600',
  in_repair: 'bg-orange-100 text-orange-700',
  pulled_out: 'bg-purple-100 text-purple-700',
}

// Statuses that mean this specific unit should not be sold as-is — the
// "non-saleable" concept Scenario 19 Part 5 surfaces in the count/adjustment
// UI, without a new dedicated status field (reuses this existing enum).
export const NON_SALEABLE_SERIAL_STATUSES: SerialStatus[] = [
  'held',
  'defective',
  'in_repair',
  'pulled_out',
]

export const RegisterSerialsFormSchema = z.object({
  itemId: z.string().min(1, 'Item is required'),
  warehouseId: z.string().min(1, 'Warehouse is required'),
  serialNumbersText: z
    .string()
    .min(1, 'Enter at least one serial number')
    .transform((val) =>
      val
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    ),
})

export const RegisterSerialsFormInputSchema = z.object({
  itemId: z.string().min(1, 'Item is required'),
  warehouseId: z.string().min(1, 'Warehouse is required'),
  serialNumbersText: z.string().min(1, 'Enter at least one serial number'),
})

export type RegisterSerialsFormInput = z.infer<typeof RegisterSerialsFormInputSchema>

// Scenario 08 (Caravan) — "Consign to Branch" bulk action.
export const ConsignToBranchFormSchema = z
  .object({
    hostBranchId: z.string().min(1, 'Host branch is required'),
    eventName: z.string().max(150, 'Event name is too long').optional(),
    eventStartDate: z.string().optional(),
    eventEndDate: z.string().optional(),
  })
  .refine(
    (data) =>
      !data.eventStartDate || !data.eventEndDate || data.eventEndDate >= data.eventStartDate,
    { message: 'Event end date cannot be before the start date', path: ['eventEndDate'] }
  )
export type ConsignToBranchFormValues = z.infer<typeof ConsignToBranchFormSchema>

export const UpdateSerialStatusFormSchema = z.object({
  status: SerialStatusSchema,
  warehouseId: z.string().optional(),
  soldToCustomerId: z.string().optional(),
  saleDate: z.string().optional(),
})
export type UpdateSerialStatusFormValues = z.infer<typeof UpdateSerialStatusFormSchema>

const SerialItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  sku: z.string(),
  modelNumber: z.string().nullable().optional(),
  brand: z.object({ id: z.string(), name: z.string() }).nullable().optional(),
  type: z.object({ id: z.string(), name: z.string() }).nullable().optional(),
})

const SerialBranchSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string().optional().nullable(),
})

const SerialWarehouseSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
  // Scenario 08 (Caravan) — the warehouse's own (home/ownership) branch,
  // distinct from consignedToBranch below.
  branch: SerialBranchSchema.optional().nullable(),
})

// Provenance — which receiving report this unit arrived on, if any. "age" is
// deliberately not part of this shape; it's computed at render time from
// goodsReceipt.receivedAt via formatAge() rather than stored/parsed here.
const SerialReceiptSchema = z
  .object({
    unitCost: z.coerce.number().nullable().optional(),
    goodsReceipt: z
      .object({
        code: z.string(),
        receivedAt: z.string(),
        stockTransferId: z.string().nullable().optional(),
        supplier: z.object({ name: z.string() }).nullable().optional(),
      })
      .nullable()
      .optional(),
  })
  .nullable()
  .optional()

export const SerialNumberSummarySchema = z.object({
  id: z.string(),
  serialNumber: z.string(),
  item: SerialItemSchema.optional().nullable(),
  warehouse: SerialWarehouseSchema.optional().nullable(),
  currentWarehouse: SerialWarehouseSchema.optional().nullable(),
  status: SerialStatusSchema,
  soldToCustomerId: z.string().optional().nullable(),
  saleDate: z.string().optional().nullable(),
  // Scenario 08 (Caravan) Part 1 — set when this unit is physically at a
  // host branch for an event while ownership stays with currentWarehouse's
  // own branch.
  consignedToBranch: SerialBranchSchema.optional().nullable(),
  // Optional event metadata captured at consign time, cleared alongside
  // consignedToBranch at event close or sale.
  caravanEventName: z.string().optional().nullable(),
  caravanEventStartDate: z.string().optional().nullable(),
  caravanEventEndDate: z.string().optional().nullable(),
  goodsReceiptLine: SerialReceiptSchema,
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})

// The backend nests pagination under `meta` (`{ data, meta: { total, page,
// limit, lastPage } }`), not at the top level — same shape as
// ItemListResponseSchema. Parsing the real shape and transforming it back to
// a flat one keeps every existing consumer (useSerialNumbers' `pagination`)
// unchanged.
export const SerialNumberListResponseSchema = z
  .object({
    data: z.array(SerialNumberSummarySchema),
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

export type SerialNumberSummary = z.infer<typeof SerialNumberSummarySchema>
export type SerialNumberListResponse = z.infer<typeof SerialNumberListResponseSchema>

// One physical unit's own event timeline (GET /serial-numbers/:id/movements)
// — assembled backend-side from every transaction-line table that ties back
// to this serial, since there's no per-serial StockLedger row to read.
export const SerialMovementTypeSchema = z.enum([
  'receipt',
  'transfer',
  'adjustment',
  'sale',
  'refund',
  'credit_memo',
  'debit_memo',
  'service',
])
export type SerialMovementType = z.infer<typeof SerialMovementTypeSchema>

export const SerialMovementEntrySchema = z.object({
  id: z.string(),
  type: SerialMovementTypeSchema,
  occurredAt: z.string(),
  label: z.string(),
  description: z.string(),
  referenceCode: z.string().nullable(),
})
export type SerialMovementEntry = z.infer<typeof SerialMovementEntrySchema>

export const SerialMovementsResponseSchema = z.object({
  data: z.array(SerialMovementEntrySchema),
})
export type SerialMovementsResponse = z.infer<typeof SerialMovementsResponseSchema>
