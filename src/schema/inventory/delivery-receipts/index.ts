import { z } from 'zod'

// Scenario 72 — outbound Delivery Receipts. Mirrors the backend's
// DeliveryReceiptPurpose / DeliveryReceiptStatus enums.

export const DR_PURPOSES = [
  'office_use',
  'raffle_prize',
  'giveaway',
  'donation',
  'redeemed_unit',
  'return_to_supplier',
  'to_service_center',
  'repaired_to_customer',
  'unrepaired_to_customer',
  'sales_invoice_to_follow',
  'others',
] as const

/** Giveaways only — who the units go to decides the account its memo debits. */
export const DR_GIVEAWAY_RECIPIENTS = ['customer', 'partner'] as const

export const DR_STATUSES = [
  'draft',
  'pending_approval',
  'approved',
  'posted',
  'invoiced',
  'rejected',
  'voided',
] as const

/** Scenario 72 Part 7 — purposes that move a repair ticket (UDS), not shelf
 * stock: with a ticket, the lines, warehouse and recipient come from the
 * sheet. The ticket is optional — without one the DR names its own. */
export const DR_REPAIR_PURPOSES = [
  'to_service_center',
  'repaired_to_customer',
  'unrepaired_to_customer',
] as const

export const DrPurposeSchema = z.enum(DR_PURPOSES)
export const DrStatusSchema = z.enum(DR_STATUSES)
export const DrGiveawayRecipientSchema = z.enum(DR_GIVEAWAY_RECIPIENTS)
export type DrGiveawayRecipient = z.infer<typeof DrGiveawayRecipientSchema>
export type DrPurpose = z.infer<typeof DrPurposeSchema>
export type DrStatus = z.infer<typeof DrStatusSchema>

export function isRepairPurpose(purpose: DrPurpose): boolean {
  return (DR_REPAIR_PURPOSES as readonly DrPurpose[]).includes(purpose)
}

/** A repair DR whose lines, warehouse and recipient come from its ticket. */
export function isTicketedRepair(v: Pick<DrFormValues, 'purpose' | 'udsId'>): boolean {
  return isRepairPurpose(v.purpose) && !!v.udsId
}

/** A ticketless hand-back names the customer's own unit, not shelf stock. */
export function isCustomerUnitPurpose(purpose: DrPurpose): boolean {
  return purpose === 'repaired_to_customer' || purpose === 'unrepaired_to_customer'
}

/** The raffle occasions the client named, plus a free-text escape. */
export const RAFFLE_OCCASIONS = ['Christmas Party', 'Summer Outing'] as const

// ─── Form ─────────────────────────────────────────────────────────────────────

const DrLineFormSchema = z
  .object({
    itemId: z.string().min(1, 'Pick an item'),
    /** Display-only, carried so a re-render doesn't have to refetch the item. */
    itemLabel: z.string(),
    isSerialTracked: z.boolean(),
    /** The units on a serialized line — exactly `quantity` of them. Saved as
     * one backend line per serial. */
    serials: z.array(z.object({ id: z.string(), label: z.string() })),
    quantity: z.number().positive('Quantity must be more than 0'),
    modelNumber: z.string(),
    brandName: z.string(),
    /** The system estimate until someone types over it. A typed cost is the
     * cost the line leaves at — stock ledger, debit memo and journal entry. */
    unitCost: z.number().min(0, 'Cost cannot be negative').nullable(),
    /** Only a typed cost is sent; untouched lines keep the system cost. */
    costTyped: z.boolean(),
  })
  .superRefine((line, ctx) => {
    // A serialized line saves one row per serial, so a quantity the serials do
    // not match would be lost on save — the backend has no serial-less row.
    if (!line.isSerialTracked || line.serials.length === line.quantity) return
    ctx.addIssue({
      code: 'custom',
      path: ['serials'],
      message:
        line.serials.length < line.quantity
          ? `Pick ${line.quantity} serial${line.quantity === 1 ? '' : 's'} (${line.serials.length} picked)`
          : `${line.serials.length} serials picked for a quantity of ${line.quantity}`,
    })
  })

/**
 * What a draft needs to save: a purpose, a warehouse and a date. Everything
 * else may be blank until submit — see DrSubmitSchema.
 */
export const DrFormSchema = z.object({
  purpose: DrPurposeSchema,
  occasion: z.string(),
  occasionOther: z.string().max(150),
  /** Giveaways only; '' until picked. */
  giveawayRecipient: z.union([DrGiveawayRecipientSchema, z.literal('')]),
  issueDate: z.string().min(1, 'Issue date is required'),
  warehouseId: z.string().min(1, 'Pick the issuing branch / warehouse'),
  departmentId: z.string(),
  /** Repair purposes only, optional — the UDS whose units this DR moves. */
  udsId: z.string(),
  udsLabel: z.string(),
  /** The picked ticket names the recipient (its customer, or its provider
   * once it has one), so the picker is read-only. */
  udsFixesParty: z.boolean(),
  customerId: z.string(),
  customerLabel: z.string(),
  supplierId: z.string(),
  supplierLabel: z.string(),
  deliveredTo: z.string().max(200),
  customerCode: z.string().max(50),
  address: z.string().max(500),
  contactNo: z.string().max(30),
  referenceNo: z.string().max(100),
  referenceDate: z.string(),
  reason: z.string().max(1000),
  remarks: z.string().max(1000),
  lines: z.array(DrLineFormSchema),
})
export type DrFormValues = z.infer<typeof DrFormSchema>
export type DrLineFormValues = z.infer<typeof DrLineFormSchema>

/** Same rules as the backend's submit(), so the form says so before it asks. */
export const DrSubmitSchema = DrFormSchema.superRefine((v, ctx) => {
  const issue = (path: string, message: string): void =>
    ctx.addIssue({ code: 'custom', path: [path], message })
  if (!v.reason.trim()) issue('reason', 'Say why this stock is leaving')
  if (!isTicketedRepair(v) && v.lines.length === 0) issue('lines', 'Add at least one item')
  v.lines.forEach((line, i) => {
    if (line.isSerialTracked && line.serials.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['lines', i, 'serials'],
        message: 'Pick the serials',
      })
    }
  })
  if (v.purpose === 'office_use' && !v.departmentId) {
    issue('departmentId', 'Which department will use it?')
  }
  if (v.purpose === 'raffle_prize' && !occasionOf(v)) issue('occasion', 'Pick the occasion')
  if (v.purpose === 'giveaway' && !v.giveawayRecipient) {
    issue('giveawayRecipient', 'Who is it given to?')
  }
  if (v.purpose === 'sales_invoice_to_follow' && !v.customerId) {
    issue('customerId', 'Pick the customer from CRM')
  }
  if (v.purpose === 'return_to_supplier' && !v.supplierId) issue('supplierId', 'Pick the supplier')
  if (v.purpose === 'to_service_center' && !v.supplierId) {
    issue('supplierId', 'Pick the repair provider')
  }
  if (isCustomerUnitPurpose(v.purpose) && !v.udsId && !v.customerId) {
    issue('customerId', 'Pick the customer from CRM')
  }
})

/** The raffle occasion as stored: a named one, or the typed "Other". */
export function occasionOf(v: Pick<DrFormValues, 'occasion' | 'occasionOther'>): string {
  return v.occasion === 'Other' ? v.occasionOther.trim() : v.occasion
}

// ─── API responses ────────────────────────────────────────────────────────────

/** Prisma Decimals arrive as strings. */
const decimal = z.union([z.string(), z.number()]).transform(Number)

const DrLineSchema = z.object({
  id: z.string(),
  lineNumber: z.number(),
  itemId: z.string(),
  serialNumberId: z.string().nullable(),
  quantity: decimal,
  unitCost: decimal.nullable(),
  estimatedUnitCost: z.number().optional(),
  description: z.string().nullable(),
  item: z.object({
    id: z.string(),
    name: z.string(),
    sku: z.string(),
    modelNumber: z.string().nullable(),
    isSerialTracked: z.boolean(),
    brand: z.object({ id: z.string(), name: z.string() }).nullable(),
  }),
  serialNumber: z
    .object({ id: z.string(), serialNumber: z.string(), status: z.string() })
    .nullable(),
})
export type DrLine = z.infer<typeof DrLineSchema>

const DebitMemoRefSchema = z
  .object({ id: z.string(), memoNumber: z.string(), status: z.string() })
  .nullable()
  .optional()

export const DrDetailSchema = z.object({
  id: z.string(),
  drNumber: z.string(),
  purpose: DrPurposeSchema,
  purposeDetail: z.string().nullable(),
  giveawayRecipient: DrGiveawayRecipientSchema.nullable().optional(),
  status: DrStatusSchema,
  issueDate: z.string(),
  warehouseId: z.string(),
  warehouse: z.object({ id: z.string(), name: z.string(), branchId: z.string().nullable() }),
  branch: z.object({ id: z.string(), name: z.string() }).nullable(),
  departmentId: z.string().nullable(),
  department: z.object({ id: z.string(), name: z.string() }).nullable(),
  customerId: z.string().nullable(),
  customer: z.object({ id: z.string(), customerCode: z.string(), name: z.string() }).nullable(),
  supplierId: z.string().nullable(),
  supplier: z.object({ id: z.string(), name: z.string() }).nullable(),
  deliveredTo: z.string().nullable(),
  customerCode: z.string().nullable(),
  address: z.string().nullable(),
  contactNo: z.string().nullable(),
  referenceNo: z.string().nullable(),
  referenceDate: z.string().nullable(),
  reason: z.string().nullable(),
  remarks: z.string().nullable(),
  submittedAt: z.string().nullable(),
  approvedAt: z.string().nullable(),
  rejectedAt: z.string().nullable(),
  rejectReason: z.string().nullable(),
  postedAt: z.string().nullable(),
  voidedAt: z.string().nullable(),
  voidReason: z.string().nullable(),
  createdAt: z.string(),
  debitMemo: DebitMemoRefSchema,
  /** Return to supplier only (Scenario 72 Part 8) — drafted with the DR. */
  supplierDebitMemo: DebitMemoRefSchema,
  /** Scenario 72 Part 6 — the POS sale that invoiced a sales invoice to follow. */
  posTransaction: z.object({ id: z.string(), transactionNumber: z.string() }).nullable().optional(),
  /** Scenario 72 Part 7 — the repair ticket a repair-purpose DR moved. */
  udsId: z.string().nullable().optional(),
  uds: z
    .object({
      id: z.string(),
      code: z.string(),
      status: z.string(),
      repairProviderId: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  lines: z.array(DrLineSchema),
})
export type DrDetail = z.infer<typeof DrDetailSchema>

export const DrSummarySchema = z.object({
  id: z.string(),
  drNumber: z.string(),
  purpose: DrPurposeSchema,
  status: DrStatusSchema,
  issueDate: z.string(),
  deliveredTo: z.string().nullable(),
  referenceNo: z.string().nullable(),
  createdAt: z.string(),
  warehouse: z.object({ id: z.string(), name: z.string() }),
  department: z.object({ id: z.string(), name: z.string() }).nullable(),
  debitMemo: DebitMemoRefSchema,
  /** Return to supplier only (Scenario 72 Part 8) — drafted with the DR. */
  supplierDebitMemo: DebitMemoRefSchema,
  _count: z.object({ lines: z.number() }),
})
export type DrSummary = z.infer<typeof DrSummarySchema>

export const DrListResponseSchema = z.object({
  data: z.array(DrSummarySchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
})
export type DrListResponse = z.infer<typeof DrListResponseSchema>

export const DrCustomerLookupSchema = z.object({
  id: z.string(),
  customerCode: z.string(),
  name: z.string(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
})
export type DrCustomerLookup = z.infer<typeof DrCustomerLookupSchema>

export const DrDepartmentLookupSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string().nullable(),
})
export type DrDepartmentLookup = z.infer<typeof DrDepartmentLookupSchema>

/** A repair ticket the DR form can pick for a repair purpose (eligible now,
 * not on another open DR for the same leg). */
export const DrUdsLookupSchema = z.object({
  id: z.string(),
  code: z.string(),
  status: z.string(),
  warehouseId: z.string().nullable(),
  customer: z.object({ id: z.string(), name: z.string() }).nullable(),
  repairProvider: z.object({ id: z.string(), name: z.string() }).nullable(),
  lines: z.array(
    z.object({
      itemId: z.string(),
      serialNumberId: z.string(),
      item: z.object({
        name: z.string(),
        modelNumber: z.string().nullable(),
        isSerialTracked: z.boolean(),
        brand: z.object({ name: z.string() }).nullable(),
      }),
      serialNumber: z.object({ serialNumber: z.string() }),
    })
  ),
})
export type DrUdsLookup = z.infer<typeof DrUdsLookupSchema>
