import { z } from 'zod'

export const SupplierDebitMemoStatusSchema = z.enum(['DRAFT', 'APPROVED', 'FINAL', 'VOID'])

export const SupplierDebitMemoLineSchema = z.object({
  // Which of the form's two tables this line belongs in, so an item line
  // whose item is not picked yet still sits among the goods rather than
  // dropping into the charges below them. Client-only — stripped before the
  // payload is sent, since the server infers the same thing from `itemId`.
  kind: z.enum(['goods', 'charge']).optional(),
  // Optional: a line with no item is a non-inventory deduction — a freight
  // recharge or negotiated allowance riding along on the same memo. Only
  // lines with an item move stock.
  itemId: z.string().optional(),
  serialNumberId: z.string().optional(),
  accountId: z.string().optional(),
  // Where the unit originally came in. Provenance only — the bill the memo is
  // eventually applied to is chosen on the AP voucher, and need not be this.
  sourceApBillId: z.string().optional(),
  sourceGoodsReceiptId: z.string().optional(),
  description: z.string().max(500).optional(),
  quantity: z.number().positive('Quantity must be greater than 0'),
  unitPrice: z.number().min(0, 'Unit price cannot be negative'),
  taxCode: z.string().max(50).optional(),
  // Accepts '' so the field can sit empty while the user clears and retypes
  // it, matching how CreditMemoLineRow handles the same problem. The submit
  // mapping normalizes a leftover '' before it reaches the API.
  taxAmount: z.union([z.number().min(0, 'Cannot be negative'), z.literal('')]).optional(),
})

/** Scenario 72 Part 8 (S71 items 14/15) — no invoice is named here. The
 * posted memo waits in Due from Suppliers until accounting applies it to one
 * of the supplier's bills from the AP voucher, so there is no balance to cap
 * the total against at this point. */
export const SupplierDebitMemoFormSchema = z.object({
  supplierId: z.string().min(1, 'Supplier is required'),
  // Typed in only to override the generated SDM-YYYYMMDD-NNNN. Blank means
  // "generate one", which is the normal case.
  memoNumber: z.string().max(50).optional(),
  warehouseId: z.string().min(1, 'Warehouse is required'),
  memoDate: z.string().min(1, 'Issue date is required'),
  deliveryReceiptNumber: z.string().max(50).optional(),
  reason: z.string().max(1000).optional(),
  lines: z.array(SupplierDebitMemoLineSchema).min(1, 'Add at least one line'),
})

export type SupplierDebitMemoFormValues = z.infer<typeof SupplierDebitMemoFormSchema>
export type SupplierDebitMemoLineValues = z.infer<typeof SupplierDebitMemoLineSchema>
