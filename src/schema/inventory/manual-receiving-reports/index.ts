import { z } from 'zod'
import { LineDiscountSchema } from '@/src/schema/inventory/purchase-orders'

// Scenario 53 — rebuilt from RR-05's single-item/submit-then-approve shape
// into a multi-line, draft-then-post document mirroring the normal Create
// Receiving Report screen. No approval gate: the same person who drafts a
// report may post it whenever ready.
export const ManualReceivingReportStatusSchema = z.enum(['draft', 'posted'])
export type ManualReceivingReportStatus = z.infer<typeof ManualReceivingReportStatusSchema>

export const MANUAL_RR_STATUS_LABELS: Record<ManualReceivingReportStatus, string> = {
  draft: 'Draft',
  posted: 'Posted',
}

const ManualRrItemSchema = z.object({
  id: z.string(),
  sku: z.string(),
  name: z.string(),
  isSerialTracked: z.boolean().optional(),
})

// None/VAT/Non-VAT/Exempt — same free-text convention and options as the
// regular Receive Stock flow's per-line tax code
// (create-rr/RrPricingDrawer.tsx's own TAX_CODES).
export const MANUAL_RR_TAX_CODES = [
  { value: '', label: 'None' },
  { value: 'VAT', label: 'VAT' },
  { value: 'NON_VAT', label: 'Non-VAT' },
  { value: 'EXEMPT', label: 'Exempt' },
]

// Real BIR EWT rates vary by the nature of the payment, not one flat
// document-wide rate — goods and services are withheld differently, and a
// single delivery can mix both. Independent of MANUAL_RR_TAX_CODES: a line
// can be VAT + Goods, Exempt + Services, etc.
export const MANUAL_RR_WITHHOLDING_CLASSES = [
  { value: '', label: 'None' },
  { value: 'goods', label: 'Goods (1%)' },
  { value: 'services', label: 'Services (2%)' },
]

const ManualRrWarehouseSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
  branchId: z.string().nullable().optional(),
  branch: z.object({ id: z.string(), name: z.string() }).nullable().optional(),
})

const ManualRrSupplierSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
})

// Scenario 53 — Decimal fields (quantityReceived/unitCost/vatAmount/etc)
// arrive as JSON strings, same convention as every other Decimal field in
// this codebase — coerce with Number() at display time.
export const ManualReceivingReportLineSchema = z.object({
  id: z.string(),
  itemId: z.string().nullable().optional(),
  item: ManualRrItemSchema.nullable().optional(),
  newItemName: z.string().nullable().optional(),
  quantityReceived: z.union([z.string(), z.number()]),
  unitCost: z.union([z.string(), z.number()]).nullable().optional(),
  srp: z.union([z.string(), z.number()]).nullable().optional(),
  discounts: z.array(LineDiscountSchema).nullable().optional(),
  taxCode: z.string().nullable().optional(),
  withholdingClass: z.string().nullable().optional(),
  isFreebie: z.boolean().optional(),
  serialNumbers: z.array(z.string()).optional(),
})
export type ManualReceivingReportLine = z.infer<typeof ManualReceivingReportLineSchema>

export const ManualReceivingReportSchema = z.object({
  id: z.string(),
  code: z.string(),
  warehouseId: z.string().optional(),
  warehouse: ManualRrWarehouseSchema,
  receivedAt: z.string().nullable().optional(),
  deliveryReceiptNumber: z.string().nullable().optional(),
  supplierInvoiceNumber: z.string().nullable().optional(),
  poNumber: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  supplierId: z.string().nullable().optional(),
  supplier: ManualRrSupplierSchema.nullable().optional(),
  newSourceName: z.string().nullable().optional(),
  vatAmount: z.union([z.string(), z.number()]).nullable().optional(),
  withheldAmount: z.union([z.string(), z.number()]).nullable().optional(),
  journalEntryId: z.string().nullable().optional(),
  apBillId: z.string().nullable().optional(),
  status: ManualReceivingReportStatusSchema,
  createdById: z.string(),
  createdByName: z.string().nullable().optional(),
  postedById: z.string().nullable().optional(),
  postedByName: z.string().nullable().optional(),
  postedAt: z.string().nullable().optional(),
  lines: z.array(ManualReceivingReportLineSchema),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})
export type ManualReceivingReport = z.infer<typeof ManualReceivingReportSchema>

export const ManualReceivingReportListResponseSchema = z.object({
  data: z.array(ManualReceivingReportSchema),
  meta: z.object({
    total: z.number(),
    page: z.number(),
    limit: z.number(),
    lastPage: z.number(),
  }),
})
export type ManualReceivingReportListResponse = z.infer<
  typeof ManualReceivingReportListResponseSchema
>

// Scenario 53 — a line's itemId/newItemName mirrors the header's
// supplierId/newSourceName either/or rule, just scoped to one row: a
// document can receive several different items, some catalog, some not.
export const ManualReceivingReportLineFormSchema = z
  .object({
    itemId: z.string().optional(),
    newItemName: z.string().max(255).optional(),
    quantityReceived: z.number().positive('Required'),
    unitCost: z.number().positive().optional(),
    // Scenario 53 (2nd pass) — SRP + a discount chain, same shape/math as
    // the Purchase Order line grid: each step's output feeds the next.
    // Client-computed only; unitCost above is the resulting figure actually
    // sent. Null/absent when unitCost was typed directly (e.g. any
    // "Something else" line with no catalog SRP to reference).
    srp: z.number().min(0).optional(),
    discounts: z.array(LineDiscountSchema).optional(),
    // Scenario 53 (3rd pass, developer decision 2026-09-20) — per-line, not
    // a single document-wide toggle: a 'VAT' line has 12% backed out of its
    // unitCost; every other code (Non-VAT/Exempt/none) leaves it as-is.
    taxCode: z.string().optional(),
    // Scenario 53 (4th pass, same day) — withholding moved per-line too,
    // independent of taxCode: 'goods' withholds 1% of this line's net cost,
    // 'services' withholds 2%, summed into one document-level figure — see
    // manualRrCosting.ts.
    withholdingClass: z.string().optional(),
    isFreebie: z.boolean().optional(),
    serialNumbers: z.array(z.string().min(1, 'Required')).optional(),
  })
  .refine((data) => !!data.itemId || !!data.newItemName?.trim(), {
    message: 'Pick a catalog item or name what was received.',
    path: ['itemId'],
  })
export type ManualReceivingReportLineFormValues = z.infer<
  typeof ManualReceivingReportLineFormSchema
>

export const CreateManualReceivingReportFormSchema = z
  .object({
    warehouseId: z.string().min(1, 'Location is required'),
    receivedAt: z.string().optional(),
    deliveryReceiptNumber: z.string().max(100).optional(),
    supplierInvoiceNumber: z.string().max(100).optional(),
    poNumber: z.string().max(100).optional(),
    notes: z.string().max(1000).optional(),
    supplierId: z.string().optional(),
    newSourceName: z.string().max(255).optional(),
    lines: z.array(ManualReceivingReportLineFormSchema).min(1, 'At least one line is required.'),
  })
  .refine(
    (data) => {
      const anyCosted = data.lines.some((l) => l.unitCost != null)
      return !anyCosted || !!data.supplierId || !!data.newSourceName
    },
    { message: 'A source is required once any line carries a unit cost.', path: ['supplierId'] }
  )
export type CreateManualReceivingReportFormValues = z.infer<
  typeof CreateManualReceivingReportFormSchema
>
