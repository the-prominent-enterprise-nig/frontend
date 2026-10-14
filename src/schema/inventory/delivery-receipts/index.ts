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
] as const

export const DR_STATUSES = [
  'draft',
  'pending_approval',
  'approved',
  'posted',
  'invoiced',
  'rejected',
  'voided',
] as const

export const DrPurposeSchema = z.enum(DR_PURPOSES)
export const DrStatusSchema = z.enum(DR_STATUSES)
export type DrPurpose = z.infer<typeof DrPurposeSchema>
export type DrStatus = z.infer<typeof DrStatusSchema>

/** The raffle occasions the client named, plus a free-text escape. */
export const RAFFLE_OCCASIONS = ['Christmas Party', 'Summer Outing'] as const

// ─── Form ─────────────────────────────────────────────────────────────────────

const DrLineFormSchema = z.object({
  itemId: z.string().min(1, 'Pick an item'),
  /** Display-only, carried so a re-render doesn't have to refetch the item. */
  itemLabel: z.string(),
  isSerialTracked: z.boolean(),
  serialNumberId: z.string(),
  serialLabel: z.string(),
  quantity: z.number().positive('Quantity must be more than 0'),
  modelNumber: z.string(),
  brandName: z.string(),
  /** Read-only: the catalog cost until saved, then the server's estimate.
   * Never sent — the backend stamps the real cost when stock leaves. */
  unitCost: z.number().nullable(),
})

/**
 * What a draft needs to save: a purpose, a warehouse and a date. Everything
 * else may be blank until submit — see DrSubmitSchema.
 */
export const DrFormSchema = z.object({
  purpose: DrPurposeSchema,
  occasion: z.string(),
  occasionOther: z.string().max(150),
  issueDate: z.string().min(1, 'Issue date is required'),
  warehouseId: z.string().min(1, 'Pick the issuing branch / warehouse'),
  departmentId: z.string(),
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
  if (v.lines.length === 0) issue('lines', 'Add at least one item')
  v.lines.forEach((line, i) => {
    if (line.isSerialTracked && !line.serialNumberId) {
      ctx.addIssue({
        code: 'custom',
        path: ['lines', i, 'serialNumberId'],
        message: 'Pick the serial',
      })
    }
  })
  if (v.purpose === 'office_use' && !v.departmentId) {
    issue('departmentId', 'Which department will use it?')
  }
  if (v.purpose === 'raffle_prize' && !occasionOf(v)) issue('occasion', 'Pick the occasion')
  if (v.purpose === 'sales_invoice_to_follow' && !v.customerId) {
    issue('customerId', 'Pick the customer from CRM')
  }
  if (v.purpose === 'return_to_supplier' && !v.supplierId) issue('supplierId', 'Pick the supplier')
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
