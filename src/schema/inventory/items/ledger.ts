import { z } from 'zod'

const WarehouseRefSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
})

export const ItemLedgerEntrySchema = z.object({
  id: z.string(),
  occurredAt: z.string(),
  transactionType: z.string(),
  quantityIn: z.coerce.number(),
  quantityOut: z.coerce.number(),
  quantityChange: z.coerce.number(),
  runningBalance: z.coerce.number(),
  unitCost: z.coerce.number().nullable().optional(),
  referenceType: z.string().nullable().optional(),
  referenceId: z.string().nullable().optional(),
  referenceCode: z.string().nullable().optional(),
  reasonCode: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  warehouse: WarehouseRefSchema,
})

export const ItemLedgerResponseSchema = z.object({
  item: z.object({
    id: z.string(),
    name: z.string(),
    sku: z.string(),
    lifecycle: z.string(),
    baseUnit: z.object({
      id: z.string(),
      name: z.string(),
      code: z.string(),
    }),
  }),
  currentBalances: z.array(
    z.object({
      warehouse: WarehouseRefSchema,
      onHandQty: z.coerce.number(),
      reservedQty: z.coerce.number(),
      availableQty: z.coerce.number(),
      lastMovementAt: z.string().nullable().optional(),
    })
  ),
  openingBalance: z.coerce.number(),
  data: z.array(ItemLedgerEntrySchema),
  meta: z.object({
    total: z.number(),
    page: z.number(),
    limit: z.number(),
    lastPage: z.number(),
  }),
})

export type ItemLedgerEntry = z.infer<typeof ItemLedgerEntrySchema>
export type ItemLedgerResponse = z.infer<typeof ItemLedgerResponseSchema>
