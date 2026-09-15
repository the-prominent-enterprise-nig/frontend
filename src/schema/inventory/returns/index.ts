import { z } from 'zod'

export const ReturnConditionSchema = z.enum(['sellable', 'damaged'])

export const CreateReturnFormSchema = z.object({
  itemId: z.string().min(1, 'Item is required'),
  warehouseId: z.string().min(1, 'Warehouse is required'),
  quantity: z.number().positive('Quantity must be greater than 0'),
  condition: ReturnConditionSchema,
  notes: z.string().max(1000).optional(),
  batchId: z.string().optional(),
  locationId: z.string().optional(),
  serialNumberId: z.string().optional(),
  repairDecision: z.enum(['restock', 'flag_for_repair']).optional(),
  /** Optional on purpose — a return with no invoice still records the stock
   *  and posts its cost reversal, it just never reaches AR. Naming one also
   *  raises the sales-return credit memo against it. */
  arInvoiceId: z.string().optional(),
  /** The cashier-entered SI off the original sale — the paper the customer
   *  brings back with the goods. Recorded on the ledger row so the return can
   *  be read against what they actually presented; distinct from
   *  `arInvoiceId`, which only drives the credit memo. */
  salesInvoiceNumber: z.string().max(100).optional(),
  customerId: z.string().optional(),
  // The RR handed to the customer at repair intake is issued server-side
  // (UdsService#generateIntakeReceivingReportNumber) and comes back on the
  // response — it is not an input, so the form never sends one.
  // Scenario 50 — the customer's proof of purchase, so a repair can be traced
  // back to the sale it came from. Free text for the same reason the RR number
  // above is: the unit may have been sold on paper, before this system, or by
  // a branch whose records never became an ArInvoice row, and a hard link
  // would make the common case unrecordable. Distinct from `arInvoiceId`,
  // which a custodial repair intake deliberately leaves unset.
  intakeSalesInvoiceNumber: z.string().max(50).optional(),
})

export type CreateReturnFormValues = z.infer<typeof CreateReturnFormSchema>
export type ReturnCondition = z.infer<typeof ReturnConditionSchema>

const ReturnItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  sku: z.string(),
})

const ReturnWarehouseSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string().optional(),
  branch: z.object({ id: z.string(), name: z.string() }).nullable().optional(),
})

export const ReturnSummarySchema = z.object({
  id: z.string(),
  transactionType: z.string().optional(),
  quantity: z.coerce.number(),
  condition: ReturnConditionSchema.optional().nullable(),
  /** Written only by the POS restock path now (the refund transaction's own
   *  id) — the create form dropped its free-text version of this in favour of
   *  the real Original Invoice link. */
  originalSaleId: z.string().optional().nullable(),
  /** The readable number behind `originalSaleId`, resolved server-side — that
   *  field holds a PosTransaction UUID, which is no use to anyone reading a
   *  list. Null on a return processed at the counter, which has no POS
   *  transaction behind it. */
  posTransactionNumber: z.string().optional().nullable(),
  /** The documents the return was transacted on: the SI the customer brought
   *  in, and the RR the branch issued them for the goods. */
  salesInvoiceNumber: z.string().optional().nullable(),
  receivingReportNumber: z.string().optional().nullable(),
  /** Which way the unit went after the counter. A restock moved stock; a
   *  repair intake moved none — the unit stayed the customer's property — and
   *  carries the UDS its custody is recorded on instead. */
  outcome: z.enum(['restocked', 'in_repair']).optional(),
  uds: z.object({ id: z.string(), code: z.string(), status: z.string() }).optional().nullable(),
  notes: z.string().optional().nullable(),
  item: ReturnItemSchema.optional().nullable(),
  warehouse: ReturnWarehouseSchema.optional().nullable(),
  occurredAt: z.string().optional(),
  createdAt: z.string().optional(),
  unitCost: z.coerce.number().optional().nullable(),
  customerId: z.string().optional().nullable(),
  customer: z
    .object({
      id: z.string(),
      name: z.string(),
      customerCode: z.string().optional().nullable(),
    })
    .optional()
    .nullable(),
  serialNumberId: z.string().optional().nullable(),
  serialNumber: z.string().optional().nullable(),
  journalEntryId: z.string().optional().nullable(),
  creditMemoId: z.string().optional().nullable(),
  creditMemoNumber: z.string().optional().nullable(),
})

export const ReturnListResponseSchema = z.object({
  data: z.array(ReturnSummarySchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
})

export type ReturnSummary = z.infer<typeof ReturnSummarySchema>
export type ReturnListResponse = z.infer<typeof ReturnListResponseSchema>

/** One line of a customer's own purchase history, used to pick the unit being
 *  returned. Carries enough to fill the rest of the form in one go: the item,
 *  the specific serial, what it sold for, and the invoice behind it. */
export const CustomerPurchaseSchema = z.object({
  id: z.string(),
  itemId: z.string(),
  itemName: z.string().nullable(),
  itemSku: z.string().nullable(),
  quantity: z.coerce.number(),
  unitPrice: z.coerce.number(),
  serialNumberId: z.string().nullable(),
  serialNumber: z.string().nullable(),
  transactionNumber: z.string(),
  /** The cashier-entered Sales Invoice number off the POS. This is the paper
   *  the customer keeps, so it is what they produce as proof of purchase —
   *  not `arInvoiceNumber` (the AR sub-ledger's own number for a charge sale)
   *  and not `transactionNumber` (internal to POS). Null when the cashier
   *  left it blank. */
  salesInvoiceNumber: z.string().nullable(),
  occurredAt: z.string(),
  arInvoiceId: z.string().nullable(),
  arInvoiceNumber: z.string().nullable(),
})

export type CustomerPurchase = z.infer<typeof CustomerPurchaseSchema>
