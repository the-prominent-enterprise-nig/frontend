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
  'lost_in_transit',
  'in_transit',
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
  lost_in_transit: 'Lost in Transit',
  in_transit: 'In Transit',
}

export const SERIAL_STATUS_COLORS: Record<SerialStatus, string> = {
  // Matches the Stock Balance tab's "In Stock" pill (StockBalanceList.tsx)
  // so the same status reads identically across the Stock hub.
  in_stock: 'bg-[#e7f5ef] text-[#0b6644]',
  held: 'bg-amber-100 text-amber-700',
  sold: 'bg-blue-100 text-blue-700',
  returned: 'bg-yellow-100 text-yellow-700',
  defective: 'bg-red-100 text-red-700',
  scrapped: 'bg-zinc-100 text-zinc-600',
  in_repair: 'bg-orange-100 text-orange-700',
  pulled_out: 'bg-purple-100 text-purple-700',
  lost_in_transit: 'bg-pink-100 text-pink-700',
  in_transit: 'bg-sky-100 text-sky-700',
}

// The leading dot the Serial Numbers tab's pill badges use — kept separate
// from SERIAL_STATUS_COLORS (a bg/text pair) since the dot needs a solid
// `bg-*` of its own, one shade darker than the pill background.
export const SERIAL_STATUS_DOT_COLORS: Record<SerialStatus, string> = {
  in_stock: 'bg-[#0f7b52]',
  held: 'bg-amber-500',
  sold: 'bg-blue-500',
  returned: 'bg-yellow-500',
  defective: 'bg-red-500',
  scrapped: 'bg-zinc-400',
  in_repair: 'bg-orange-500',
  pulled_out: 'bg-purple-500',
  lost_in_transit: 'bg-pink-500',
  in_transit: 'bg-sky-500',
}

// Statuses that mean this specific unit should not be sold as-is — the
// "non-saleable" concept Scenario 19 Part 5 surfaces in the count/adjustment
// UI, without a new dedicated status field (reuses this existing enum).
export const NON_SALEABLE_SERIAL_STATUSES: SerialStatus[] = [
  'held',
  'defective',
  'in_repair',
  'pulled_out',
  'lost_in_transit',
  'in_transit',
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

// Scenario 08 (Caravan) — the "Consign" bulk action. Stock goes out either
// to one of our own branches (which then sells it) or to a place that isn't
// a branch at all — a fair, a dealer's floor, a town we have no branch in.
// For a venue nothing changes hands: the owning branch keeps the units on
// its books and keeps selling them, so only their location is really being
// recorded.
export const ConsignToBranchFormSchema = z
  .object({
    destinationKind: z.enum(['branch', 'venue']),
    hostBranchId: z.string().optional(),
    venue: z.string().max(150, 'Venue name is too long').optional(),
    eventName: z.string().max(150, 'Event name is too long').optional(),
    eventStartDate: z.string().optional(),
    eventEndDate: z.string().optional(),
  })
  .refine((data) => data.destinationKind !== 'branch' || !!data.hostBranchId?.trim(), {
    message: 'Host branch is required',
    path: ['hostBranchId'],
  })
  .refine((data) => data.destinationKind !== 'venue' || !!data.venue?.trim(), {
    message: 'Say where the units are going',
    path: ['venue'],
  })
  .refine(
    (data) =>
      !data.eventStartDate || !data.eventEndDate || data.eventEndDate >= data.eventStartDate,
    { message: 'Event end date cannot be before the start date', path: ['eventEndDate'] }
  )
export type ConsignToBranchFormValues = z.infer<typeof ConsignToBranchFormSchema>

export const UpdateSerialStatusFormSchema = z
  .object({
    status: SerialStatusSchema,
    warehouseId: z.string().optional(),
    soldToCustomerId: z.string().optional(),
    saleDate: z.string().optional(),
  })
  // "Sold" is the one transition the backend actually needs extra data for
  // (who bought it, and when) — every other status only needs the enum
  // value itself, so this stays a conditional refinement rather than making
  // these fields required across the whole schema.
  .superRefine((data, ctx) => {
    if (data.status !== 'sold') return
    if (!data.soldToCustomerId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Select the customer this unit was sold to',
        path: ['soldToCustomerId'],
      })
    }
    if (!data.saleDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Sale date is required',
        path: ['saleDate'],
      })
    }
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
        id: z.string(),
        code: z.string(),
        receivedAt: z.string(),
        stockTransferId: z.string().nullable().optional(),
        // Scenario 50 Gap 6 — the ST number itself, not just the id. Real
        // Prisma relation on the backend, so this is one nested select away.
        stockTransfer: z.object({ transferNumber: z.string() }).nullable().optional(),
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
  // The same, for a consignment whose holder isn't a branch at all — a
  // venue. Ownership never moved, so the unit stays on its own branch's
  // books (and its sellable list) while it's out.
  consignedToVenue: z.string().optional().nullable(),
  // Optional event metadata captured at consign time, cleared alongside
  // consignedToBranch at event close or sale.
  caravanEventName: z.string().optional().nullable(),
  caravanEventStartDate: z.string().optional().nullable(),
  caravanEventEndDate: z.string().optional().nullable(),
  goodsReceiptLine: SerialReceiptSchema,
  // Set while an open transfer (requested through partially received)
  // already claims this unit.
  openTransfer: z.object({ transferNumber: z.string() }).nullable().optional(),
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

// Scenario 08 (Caravan) — the "By Item" rollup of the same rows the Caravan
// serial list returns. One row is one item at one destination for one event:
// the same item out at a venue and hosted in for someone else's event are two
// separate things to count, and the tab shows both halves at once.
export const CaravanItemGroupSchema = z.object({
  key: z.string(),
  item: SerialItemSchema.nullable(),
  quantity: z.number(),
  // Per-status unit counts within the group, keyed by SerialStatus. Left as a
  // loose record so a status added backend-side surfaces instead of failing
  // the parse and blanking the whole tab.
  statusCounts: z.record(z.string(), z.number()).default({}),
  consignedToBranch: SerialBranchSchema.nullable(),
  consignedToVenue: z.string().nullable(),
  caravanEventName: z.string().nullable(),
  caravanEventStartDate: z.string().nullable(),
  caravanEventEndDate: z.string().nullable(),
})
export type CaravanItemGroup = z.infer<typeof CaravanItemGroupSchema>

// Rebuilds a serial's rollup key exactly as consignedSummary composes it
// backend-side, so an expanded group can pick its own units out of an
// item-filtered serial fetch — the list endpoint can filter by item but has no
// venue/event filter to narrow to one group on its own.
export function caravanGroupKey(serial: {
  item?: { id: string } | null
  consignedToBranch?: { id: string } | null
  consignedToVenue?: string | null
  caravanEventName?: string | null
  caravanEventStartDate?: string | null
  caravanEventEndDate?: string | null
}): string {
  return [
    serial.item?.id ?? '',
    serial.consignedToBranch?.id ?? '',
    serial.consignedToVenue ?? '',
    serial.caravanEventName ?? '',
    serial.caravanEventStartDate ?? '',
    serial.caravanEventEndDate ?? '',
  ].join('|')
}

export const CaravanItemGroupListResponseSchema = z
  .object({
    data: z.array(CaravanItemGroupSchema),
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
export type CaravanItemGroupListResponse = z.infer<typeof CaravanItemGroupListResponseSchema>

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
  customerName: z.string().nullable().optional(),
  invoiceNumber: z.string().nullable().optional(),
})
export type SerialMovementEntry = z.infer<typeof SerialMovementEntrySchema>

export const SerialMovementsResponseSchema = z.object({
  data: z.array(SerialMovementEntrySchema),
})
export type SerialMovementsResponse = z.infer<typeof SerialMovementsResponseSchema>
