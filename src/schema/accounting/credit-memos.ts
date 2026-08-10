import { z } from 'zod'

export const CreditMemoTypeSchema = z.enum(['sales_return', 'billing_adjustment', 'goodwill'])

export const CreateCreditMemoLineSchema = z.object({
  itemId: z.string().min(1, 'Item is required'),
  quantity: z.number().positive('Quantity must be greater than 0'),
  unitPrice: z.number().positive('Unit price must be greater than 0'),
  serialNumberId: z.string().optional(),
  // Accepts '' (not just number|undefined) so the field can hold '' while
  // the user is actively clearing/retyping it (see CreditMemoLineRow's
  // onChange) without Zod rejecting the keystroke. handleFormSubmit's own
  // `deductionAmount: l.deductionAmount || undefined` mapping already
  // normalizes a leftover '' to undefined before it reaches the API.
  deductionAmount: z.union([z.number().min(0, 'Cannot be negative'), z.literal('')]).optional(),
})

// outstanding is a runtime prop (the invoice's remaining balance), not part
// of the form's own field values — built per-render so the cross-field
// refine can validate against it.
export function buildCreateCreditMemoFormSchema(outstanding: number) {
  return z
    .object({
      type: CreditMemoTypeSchema,
      reason: z.string().max(1000).optional(),
      memoDate: z.string().min(1, 'Memo date is required'),
      lines: z.array(CreateCreditMemoLineSchema).min(1, 'At least one line is required'),
    })
    .refine(
      (d) => {
        const total = d.lines.reduce(
          (sum, l) => sum + l.quantity * l.unitPrice - (Number(l.deductionAmount) || 0),
          0
        )
        return total > 0
      },
      { message: 'Total credit (Gross − Deductions) must be greater than zero', path: ['lines'] }
    )
    .refine(
      (d) => {
        const total = d.lines.reduce(
          (sum, l) => sum + l.quantity * l.unitPrice - (Number(l.deductionAmount) || 0),
          0
        )
        return total <= outstanding + 0.01
      },
      {
        message: 'Total credit cannot exceed the invoice outstanding balance',
        path: ['lines'],
      }
    )
}

export type CreditMemoType = z.infer<typeof CreditMemoTypeSchema>
export type CreateCreditMemoLineValues = z.infer<typeof CreateCreditMemoLineSchema>
export type CreateCreditMemoFormValues = {
  type: CreditMemoType
  reason?: string
  memoDate: string
  lines: CreateCreditMemoLineValues[]
}
