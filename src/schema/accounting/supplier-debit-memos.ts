import { z } from 'zod'

export const SupplierDebitMemoStatusSchema = z.enum(['DRAFT', 'APPROVED', 'FINAL', 'VOID'])

export const SupplierDebitMemoLineSchema = z.object({
  // Optional: a line with no item is a non-inventory deduction — a freight
  // recharge or negotiated allowance riding along on the same memo. Only
  // lines with an item move stock.
  itemId: z.string().optional(),
  serialNumberId: z.string().optional(),
  accountId: z.string().optional(),
  // Where the unit originally came in. Deliberately never validated against
  // the memo's own settlement bill — a deduction may sit on any of the
  // supplier's open invoices, not the one the damaged unit arrived on.
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

/** `outstanding` is a runtime prop (the chosen bill's remaining balance), not
 * a form field — the schema is built per-render so the total can be checked
 * against it, the same shape buildCreateCreditMemoFormSchema uses. */
export function buildSupplierDebitMemoFormSchema(outstanding: number) {
  return z
    .object({
      apBillId: z.string().min(1, 'Purchase invoice is required'),
      // Typed in only to override the generated SDM-YYYYMMDD-NNNN. Blank means
      // "generate one", which is the normal case.
      memoNumber: z.string().max(50).optional(),
      warehouseId: z.string().min(1, 'Warehouse is required'),
      memoDate: z.string().min(1, 'Issue date is required'),
      deliveryReceiptNumber: z.string().max(50).optional(),
      reason: z.string().max(1000).optional(),
      lines: z.array(SupplierDebitMemoLineSchema).min(1, 'Add at least one line'),
    })
    .superRefine((data, ctx) => {
      // Matches the server: every line adds, and the total is what comes off
      // the supplier's invoice. Quantity multiplies a goods line only — a
      // concession (no item) is a flat negotiated sum.
      const total = data.lines.reduce(
        (sum, line) =>
          sum +
          (line.itemId ? line.quantity * line.unitPrice : line.unitPrice) +
          (typeof line.taxAmount === 'number' ? line.taxAmount : 0),
        0
      )
      // Mirrors the server's own guard so the user finds out before
      // submitting, not after. The server re-checks regardless — this is
      // convenience, not the control.
      if (total > outstanding + 0.01) {
        ctx.addIssue({
          code: 'custom',
          message: `Total (${total.toFixed(2)}) exceeds the invoice's outstanding balance (${outstanding.toFixed(2)}).`,
          path: ['lines'],
        })
      }
    })
}

export type SupplierDebitMemoFormValues = z.infer<
  ReturnType<typeof buildSupplierDebitMemoFormSchema>
>
export type SupplierDebitMemoLineValues = z.infer<typeof SupplierDebitMemoLineSchema>
