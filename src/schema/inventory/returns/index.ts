import { z } from 'zod'

/**
 * What happens to a returned unit — one question with one consequence each,
 * replacing the condition × repairDecision pair the old form asked. That pair
 * had six combinations of which three meant anything, and its undefined
 * repairDecision rendered as though "restock" were chosen while sending
 * nothing at all.
 */
export const ReturnDispositionSchema = z.enum([
  'restock',
  'quarantine',
  'scrap',
  'repair',
  'exchange',
])
export type ReturnDisposition = z.infer<typeof ReturnDispositionSchema>

/**
 * Why it came back, as a fixed list.
 *
 * Free text was the old field and it recorded nothing usable — "d" and
 * "defective" and "DEFECTIVE UNIT!!" are the same fact spelled three ways, so
 * nobody could ever count them. The codes are what the form holds; the labels
 * are what gets written to the document, because the detail panel and the
 * customer's copy are read by people, not by a report.
 */
export const RETURN_REASONS = [
  { code: 'defective', label: 'Defective on arrival' },
  { code: 'failed', label: 'Stopped working' },
  { code: 'wrong', label: 'Wrong item delivered' },
  { code: 'damaged', label: 'Damaged in transit' },
  { code: 'changed', label: 'Changed their mind' },
  { code: 'warranty', label: 'Warranty claim' },
] as const

export const ReturnReasonSchema = z.enum([
  'defective',
  'failed',
  'wrong',
  'damaged',
  'changed',
  'warranty',
])
export type ReturnReasonCode = z.infer<typeof ReturnReasonSchema>

export const REASON_LABELS: Record<ReturnReasonCode, string> = Object.fromEntries(
  RETURN_REASONS.map((r) => [r.code, r.label])
) as Record<ReturnReasonCode, string>

/**
 * Which dispositions demand a second answer, and which put money back.
 *
 * `credit` drives the settlement figures: a repair is the one outcome where
 * the customer keeps title to the unit, so it is the one that credits nothing.
 * An exchange credits nothing either, but for the opposite reason — they walk
 * out with a replacement instead of money.
 */
export const DISPOSITION_META: Record<
  ReturnDisposition,
  { label: string; note: string; credit: boolean; needs: 'text' | 'swap' | null }
> = {
  restock: { label: 'Restock', note: 'sellable again', credit: true, needs: null },
  quarantine: { label: 'Quarantine', note: 'hold for inspection', credit: true, needs: 'text' },
  repair: { label: 'Repair', note: 'send to service', credit: false, needs: 'text' },
  exchange: { label: 'Exchange', note: 'swap the unit', credit: false, needs: 'swap' },
  scrap: { label: 'Scrap', note: 'write off', credit: true, needs: 'text' },
}

/** Fixed order, so the five buttons never reshuffle between lines. */
export const DISPOSITION_ORDER: ReturnDisposition[] = [
  'restock',
  'quarantine',
  'repair',
  'exchange',
  'scrap',
]

/** How long after the sale a return is still routine. Past it the purchase is
 *  still returnable — the clerk is only told, so they can ask before taking
 *  the goods rather than find out afterwards. */
export const RETURN_WINDOW_DAYS = 30

/** One line of a customer return. */
export const CustomerReturnLineFormSchema = z
  .object({
    itemId: z.string().min(1, 'Item is required'),
    /** Carried for display only — the picker already knows what was sold. */
    itemName: z.string().optional(),
    itemSku: z.string().optional(),
    quantity: z.number().positive('Quantity must be greater than 0'),
    /** How many of this line were sold, so the form can cap the return at it
     *  rather than letting the server refuse it after the fact. */
    soldQuantity: z.number().optional(),
    unitPrice: z.number().min(0),
    /** Empty until the clerk picks one, and deliberately so. The old form
     *  defaulted this to "restock" and sent nothing, which put a damaged unit
     *  back on the shelf whenever the question went unanswered. An unanswered
     *  question now blocks instead of guessing. */
    disposition: z.union([ReturnDispositionSchema, z.literal('')]),
    /** Required. Every line answers why, off the fixed list. */
    reasonCode: z.union([ReturnReasonSchema, z.literal('')]),
    /** The second answer quarantine, repair and scrap each demand: what is
     *  actually wrong with it. Posted appended to the reason label, because
     *  the document carries one reason column and this belongs beside it. */
    faultNote: z.string().max(400).optional(),
    serialNumberId: z.string().optional(),
    serialNumber: z.string().optional(),
    /** Whether the ITEM is serial-tracked — not whether this sale line
     *  recorded a serial. The server decides whether an exchange needs a
     *  named replacement off the item, so a tracked item sold without a
     *  serial (a line from before tracking was switched on) has to ask for
     *  one here too, or the post is refused after the fact. Never posted. */
    itemSerialTracked: z.boolean().optional(),
    sourcePosTransactionLineId: z.string().optional(),
    sourceLedgerId: z.string().optional(),
    /** The receipt this line was sold on. Never posted — it is what the form
     *  checks the picks against, since one document credits one invoice. */
    sourceReceiptNumber: z.string().optional(),
    replacementSerialNumberId: z.string().optional(),
  })
  .superRefine((line, ctx) => {
    if (line.soldQuantity != null && line.quantity > line.soldQuantity) {
      ctx.addIssue({
        code: 'custom',
        path: ['quantity'],
        message: `Only ${line.soldQuantity} were sold`,
      })
    }
    if (!line.disposition) {
      ctx.addIssue({
        code: 'custom',
        path: ['disposition'],
        message: 'Say what happens to the unit',
      })
    }
    if (!line.reasonCode) {
      ctx.addIssue({ code: 'custom', path: ['reasonCode'], message: 'Pick a reason' })
    }
    if (
      line.disposition &&
      DISPOSITION_META[line.disposition].needs === 'text' &&
      !line.faultNote?.trim()
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['faultNote'],
        message: 'Say what is wrong with it',
      })
    }
    // A custody sheet records one named unit and has no quantity column, so
    // a repair covering two units has nothing it could become.
    if (line.disposition === 'repair') {
      if (!line.serialNumberId) {
        ctx.addIssue({
          code: 'custom',
          path: ['serialNumberId'],
          message: 'A repair needs the specific unit',
        })
      }
      if (line.quantity !== 1) {
        ctx.addIssue({
          code: 'custom',
          path: ['quantity'],
          message: 'A repair covers exactly one unit',
        })
      }
    }
    // The server refuses a tracked exchange with no named replacement: the
    // unit coming back is quarantined and an unnamed one walks out.
    if (
      line.disposition === 'exchange' &&
      line.itemSerialTracked &&
      !line.replacementSerialNumberId
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['replacementSerialNumberId'],
        message: 'Pick the replacement unit going out',
      })
    }
  })

export const CustomerReturnFormSchema = z.object({
  warehouseId: z.string().min(1, 'Branch is required'),
  customerId: z.string().optional(),
  originalSaleId: z.string().optional(),
  arInvoiceId: z.string().optional(),
  salesInvoiceNumber: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
  lines: z.array(CustomerReturnLineFormSchema).min(1, 'Add at least one item'),
})

export type CustomerReturnFormValues = z.infer<typeof CustomerReturnFormSchema>
export type CustomerReturnLineFormValues = z.infer<typeof CustomerReturnLineFormSchema>

export const ReturnConditionSchema = z.enum(['sellable', 'damaged'])

/* CreateReturnFormSchema removed with the single-item modal it validated.
   The single-item POST /inventory/stock/return endpoint still exists for the
   POS void/refund path, but nothing in this app posts to it any more. */

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
  /** A legacy row carries a ReturnCondition here; a single-line document
   *  carries its disposition instead, and a multi-line one carries null —
   *  there is no one condition to report when the lines disagree. */
  condition: z.string().optional().nullable(),
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
  outcome: z.enum(['restocked', 'in_repair', 'document']).optional(),
  /** Set on a document row: the RTN- number, and the lines it carries. A
   *  legacy single-item return has neither. */
  returnNumber: z.string().optional().nullable(),
  /** Whether the document posted. Distinct from `outcome`, which says what
   *  shape of record the row is. Absent on the two legacy arms, which have
   *  no header to carry a status. */
  status: z.string().optional().nullable(),
  lineCount: z.number().optional(),
  accountingNote: z.string().optional().nullable(),
  arInvoiceId: z.string().optional().nullable(),
  lines: z
    .array(
      z.object({
        id: z.string(),
        lineNumber: z.number(),
        item: ReturnItemSchema.optional().nullable(),
        quantity: z.coerce.number(),
        unitPrice: z.coerce.number().optional().nullable(),
        disposition: ReturnDispositionSchema.optional().nullable(),
        reason: z.string().optional().nullable(),
        serialNumberId: z.string().optional().nullable(),
        serialNumber: z.string().optional().nullable(),
        replacementSerialNumber: z.string().optional().nullable(),
        uds: z
          .object({ id: z.string(), code: z.string(), status: z.string() })
          .optional()
          .nullable(),
      })
    )
    .optional(),
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
  /** Whether the item is serial-tracked. Distinct from `serialNumberId`,
   *  which only says whether THIS sale line recorded a unit — a tracked item
   *  sold without one still needs a named replacement to be exchanged, which
   *  is the rule the server enforces. Optional so an older backend that does
   *  not send it falls back to the serial on the line. */
  itemSerialTracked: z.boolean().optional(),
  quantity: z.coerce.number(),
  unitPrice: z.coerce.number(),
  serialNumberId: z.string().nullable(),
  serialNumber: z.string().nullable(),
  /** The sale's own stock ledger row, so the FIFO/LIFO cost layer is restored
   *  at the cost this exact unit left on. Null for a weighted-average item,
   *  which never gets a sale-time ledger row — which is why the quantity cap
   *  keys on the POS line instead. */
  sourceLedgerId: z.string().nullable().optional(),
  /** Who the sale was to, when it had an account behind it. A walk-in found
   *  by invoice number starts with no customer, so the form learns the name
   *  from the sale it matched rather than asking for it again. */
  customerId: z.string().nullable().optional(),
  customerName: z.string().nullable().optional(),
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
